const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');
const Promise = require('bluebird');
const co = Promise.coroutine;

const request = require('superagent');

const Q = require('q');
const _ = require('lodash');

const utils = require('./utils');

const MasterKey = require('./models/masterkey');
const WalletKey = require('./models/walletkey');
const RecoveryRequest = require('./models/recoveryrequest');

/**
 * Makes a POST request to an endpoint specified by the customer. This is used by heavy API customers
 * who would prefer to use a webhook than receiving an email for every new wallet.
 * @param key: new wallet key document
 * @param state: 'created' when the key is first created
 */
const notifyEndpoint = co(function *(key, state) {
  const generateHMAC = function(xpub){
    const hmac = crypto.createHmac('sha256', process.config.provider.secret);
    hmac.update(xpub);
    return hmac.digest('hex');
  };

  const notificationURL = key.notificationURL;
  const userEmail = key.userEmail;
  const xpub = key.xpub;
  const hmac = generateHMAC(xpub);

  try {
    yield request.post(notificationURL)
      .send({
        userEmail: userEmail,
        provider: process.config.provider.id,
        state: state,
        xpub: xpub,
        hmac: hmac
      })
  } catch (e) {
    console.log('error connecting to webhook');
  }
});

/**
 * Selects a random un-assigned master key and sets the coin and customerId fields,
 * returning the key
 * @param coin: coin ticker (btc,eth,etc.)
 * @param customerId: customer ID from the platform
 */
const provisionMasterKey = co(function *(coin, customerId) {
  const key = yield MasterKey.findOne({ coin: null, customerId: null });

  if (!key) {
    throw utils.ErrorResponse(500, 'no available keys');
  }

  key.coin = coin;
  key.customerId = customerId;

  yield key.save();

  const availableKeys = yield MasterKey.countDocuments({ coin: null, customerId: null });

  if (_.includes(process.config.lowKeyWarningLevels, availableKeys)) {
    yield utils.sendMailQ(
      process.config.adminemail,
      'URGENT: Please replenish the master key database',
      'databaselow',
      { availableKeys });
  }

  return key;
});

/**
 * Finds the currently assigned master key for the customer/coin, assigning
 * a new one if one does not exist. Then, derives a wallet key from the next
 * chain path, incrementing the keyCount on the master key
 * @param req: request object
 */
exports.provisionKey = co(function *(req) {
  const key = new WalletKey();

  const customerId = req.body.customerId;
  if (!customerId) {
    throw utils.ErrorResponse(400, 'user or enterprise ID required');
  }

  const coin = req.body.coin;
  if (!coin) {
    throw utils.ErrorResponse(400, 'coin type required');
  }

  if (!process.config.supportedcoins.includes(req.body.coin)) {
    throw utils.ErrorResponse(400, 'unsupported coin');
  }

  const userEmail = req.body.userEmail;
  if (!userEmail) {
    throw utils.ErrorResponse(400, 'email required');
  }

  if (process.config.requesterAuth && process.config.requesterAuth.required) {
    if (!req.body.requesterId && !req.body.requesterSecret) {
      throw utils.ErrorResponse(401, 'this krs requires you to send a requesterId and requesterSecret to get a key');
    }
    if (!process.config.requesterAuth.clients[req.body.requesterId] ||
        process.config.requesterAuth.clients[req.body.requesterId] !== req.body.requesterSecret) {
      throw utils.ErrorResponse(401, 'invalid requesterSecret');
    }
  }

  let masterKey = yield MasterKey.findOne({ customerId, coin });

  if (!masterKey) {
    masterKey = yield provisionMasterKey(coin, customerId);
  }

  key.masterKey = masterKey.xpub;
  key.path = `m/${masterKey.keyCount}`;
  key.xpub = utils.deriveChildKey(key.masterKey, key.path);

  key.userEmail = req.body.userEmail;
  key.notificationURL = req.body.notificationURL;

  key.custom = req.body.custom || {};
  key.custom.created = new Date();

  yield key.save();

  yield masterKey.update({ $inc: { keyCount: 1 } });

  if (!req.body.disableKRSEmail) {
    try {
      yield utils.sendMailQ(
        key.userEmail,
        'Information about your BitGo backup key',
        'newkeytemplate',
        {
          xpub: key.xpub,
          servicename: process.config.name,
          serviceurl: process.config.serviceurl,
          adminemail: process.config.adminemail,
          useremail: key.userEmail
        });
    } catch (e) {
      throw utils.ErrorResponse(503, 'Problem sending email');
    }
  }

  if (key.notificationURL) {
    yield notifyEndpoint(key, 'created');
  }

  return key;
});

exports.validateKey = function(req) {
  var userEmail = req.query && req.query.userEmail;
  var xpub = req.params.xpub;

  if (_.isEmpty(userEmail) || _.isEmpty(xpub)) {
    throw utils.ErrorResponse(400, 'userEmail and xpub required');
  }

  return Key.findOneQ({userEmail: userEmail, xpub: xpub})
  .then(function(key) {
    if (!key) {
      throw utils.ErrorResponse(404, 'key and username combination not found');
    }
    return key;
  });
};

exports.requestRecovery = function(req) {
  var xpub = req.body.xpub;
  var userEmail = req.body.userEmail;
  var transactionHex = req.body.transactionHex;
  var inputs = req.body.inputs;
  var custom = req.body.custom;

  if (_.isEmpty(xpub) || _.isEmpty(userEmail) || _.isEmpty(transactionHex) || _.isEmpty(inputs)) {
    throw utils.ErrorResponse(400, 'xpub, userEmail, transactionHex and inputs required');
  }

  var recoveryRequest = {
    xpub: xpub,
    userEmail: userEmail,
    transactionHex: transactionHex,
    inputs: inputs,
    custom: custom
  };

  var sendEmailToUser = function() {
    return utils.sendMailQ(
      userEmail,
      "Bitcoin Recovery request initiated on " + process.config.name + " using your backup key",
      "recoveryusertemplate",
      {
        xpub: xpub,
        servicename: process.config.name,
        serviceurl: process.config.serviceurl,
        adminemail: process.config.adminemail,
        useremail: userEmail,
        message: custom && custom.message
      }
    );
  };

  var sendEmailToAdmin = function() {
    return utils.sendMailQ(
      process.config.adminemail,
      "Bitcoin Recovery request initiated on " + process.config.name + " for " + userEmail,
      "recoveryadmintemplate",
      {
        xpub: xpub,
        servicename: process.config.name,
        serviceurl: process.config.serviceurl,
        useremail: userEmail,
        message: custom && custom.message
      },
      // The attachments
      [
        {
          filename: 'recovery_' + xpub + '_' + moment().format('YYYYMDHm') + '.json',
          content: JSON.stringify(recoveryRequest)
        }
      ]
    );
  };

  var result;
  return Key.findOneQ({userEmail: userEmail, xpub: xpub})
  .then(function(key) {
    if (!key) {
      // no matching key found, return a fake result to throw spammers off
      result = {
        _id: mongoose.Types.ObjectId().toString(),
        created: new Date()
      };
      return result;
    }
    recoveryRequest.masterxpub = key.masterxpub;
    recoveryRequest.chainPath = key.path; // the chain path of this user
    return Q.all([RecoveryRequest.createQ(recoveryRequest), sendEmailToAdmin(), sendEmailToUser(), notifyEndpoint(key, 'prerecovery')])
    .spread(function(saveResult, emailToAdminResult, emailToUserResult, notificationResult) {
      result = saveResult;
    });
  })
  .then(function() {
    return {
      id: result._id,
      created: result.created
    };
  });
};
