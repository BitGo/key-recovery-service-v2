const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');

const request = require('superagent');
require('superagent-as-promised')(request);

const validator = require('validator');
const Q = require('q');
const _ = require('lodash');

const utils = require('./utils');
const RecoveryRequest = require('./models/recoveryrequest');

if (process.config.masterxpub.substr(0, 4) !== 'xpub') {
  throw new Error('masterxpub must start with "xpub"');
}

const notifyEndpoint = function(key, state) {
  const generateHMAC = function(xpub){
    const hmac = crypto.createHmac('sha256', process.config.provider.secret);
    hmac.update(xpub);
    return hmac.digest('hex');
  };

  const notificationURL = key.notificationURL;
  if (!notificationURL) {
    return;
  }
  const userEmail = key.userEmail;
  const xpub = key.xpub;
  const hmac = generateHMAC(xpub);

  return request.post(notificationURL)
  .send({
    userEmail: userEmail,
    provider: process.config.provider.id,
    state: state,
    xpub: xpub,
    hmac: hmac
  })
  .catch(function(err) {
    // we do not want to throw an error because this has to work even if BitGo is down
    console.log('error connecting to webhook URL');
  });
};

exports.provisionKey = function(req) {
  var userEmail = req.body.userEmail;
  if (!userEmail) {
    throw utils.ErrorResponse(400, 'userEmail required');
  }
  if (!validator.isEmail(userEmail)) {
    throw utils.ErrorResponse(400, 'email invalid');
  }

  var custom = req.body.custom || {};
  custom.created = new Date();

  var notificationURL = req.body.notificationURL;

  var path = exports.randomPath();
  var xpub = exports.deriveFromPath(path);
  var key = new Key({
    path: path,
    xpub: xpub,
    userEmail: userEmail,
    notificationURL: notificationURL,
    custom: custom,
    masterxpub: process.config.masterxpub
  });

  if (process.config.requesterAuth && process.config.requesterAuth.required) {
    if (!req.body.requesterId && !req.body.requesterSecret) {
      throw utils.ErrorResponse(401, 'this krs requires you to send a requesterId and requesterSecret to get a key');
    }
    if (!process.config.requesterAuth.clients[req.body.requesterId] ||
        process.config.requesterAuth.clients[req.body.requesterId] !== req.body.requesterSecret) {
      throw utils.ErrorResponse(401, 'invalid requesterSecret');
    }
    key.requesterId = req.body.requesterId;
  }

  return key.saveQ()
  .then(function() {
    if (req.body.disableKRSEmail) {
      // for API users who don't want their inboxes filling up with unread KRS backup key creation emails
      return;
    }
    return utils.sendMailQ(
      userEmail,
      "Information about your backup key",
      "newkeytemplate",
      {
        xpub: xpub,
        servicename: process.config.name,
        serviceurl: process.config.serviceurl,
        adminemail: process.config.adminemail,
        useremail: userEmail
      }
    )
    .catch(function(e) {
      throw utils.ErrorResponse(503, "Problem sending email");
    });
  })
  .then(function() {
    return notifyEndpoint(key, 'created');
  })
  .then(function() {
    return key;
  });
};

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

// TODO: this needs to be removed to run, but will be implemented in BG-5835
// exports.deriveFromPath = function(path) {
//   var masterHDNode = HDNode.fromBase58(process.config.masterxpub);
//   return masterHDNode.deriveFromPath(path).toBase58();
// };
