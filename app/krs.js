const crypto = require('crypto');
const Promise = require('bluebird');
const co = Promise.coroutine;

const request = require('superagent');

const _ = require('lodash');

const utils = require('./utils');

const MasterKey = require('./models/masterkey');
const WalletKey = require('./models/walletkey');

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

const sendDatabaseLowWarning = co(function *(availableKeys, type) {
  yield utils.sendMailQ(
    process.config.adminemail,
    'URGENT: Please replenish the master key database',
    'databaselow',
    { availableKeys, type });
});

/**
 * Selects a random un-assigned master key and sets the coin and customerId fields,
 * returning the key
 * @param coin: coin ticker (btc,eth,etc.)
 * @param customerId: customer ID from the platform
 */
const provisionMasterKey = co(function *(coin, customerId) {
  const keyType = process.config.supportedcoins[coin];

  const key = yield MasterKey.findOneAndUpdate({ coin: null, customerId: null, type: keyType }, { coin: coin, customerId: customerId, type: keyType });

  if (!key) {
    throw utils.ErrorResponse(500, `no available ${keyType} keys`);
  }

  const availableKeys = yield MasterKey.countDocuments({ coin: null, customerId: null, type: keyType });

  if (_.includes(process.config.lowKeyWarningLevels, availableKeys) && !process.config.disableAllKRSEmail) {
    yield sendDatabaseLowWarning(availableKeys, keyType);
  }

  return key;
});

/**
 * Tries to find an already assigned xpub for the user, or provisions one if one is not available
 * @param coin: coin ticker (btc, eth, etc.)
 * @param customerId: user or enterprise ID from BitGo
 * @return {MasterKey} the master key to use for derivation
 */
const getMasterXpub = co(function *(coin, customerId) {

  if(process.config.neverReuseMasterKey) {
    return provisionMasterKey(coin, customerId);
  }

  let masterKey = yield MasterKey.findOne({ coin, customerId });

  if (!masterKey) {
    masterKey = provisionMasterKey(coin, customerId);
  }

  return masterKey;
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

  if (!process.config.supportedcoins[coin]) {
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

  let masterKey;

  if (process.config.supportedcoins[coin] === 'xlm') {
    // ALWAYS provision a new master key for Stellar wallets, and use the master key as the wallet key
    masterKey = yield provisionMasterKey(coin, customerId);
    key.pub = masterKey.pub;
  } else {
    // find the correct master key (assigning if necessary), and derive a wallet key off of it
    masterKey = yield getMasterXpub(coin, customerId);
    key.pub = utils.deriveChildKey(masterKey.pub, '' + masterKey.keyCount, 'xpub');
  }

  key.masterKey = masterKey.pub;
  key.path = masterKey.keyCount;

  key.userEmail = req.body.userEmail;
  key.notificationURL = req.body.notificationURL;

  key.custom = req.body.custom || {};
  key.custom.created = new Date();

  yield key.save();

  // If the master key has a signature, we include the signature in the response to the user
  if (masterKey.signature) {
    key.masterKeySig = masterKey.signature;
  }

  yield masterKey.update({ $inc: { keyCount: 1 } });

  if (!req.body.disableKRSEmail && !process.config.disableAllKRSEmail) {
    try {
      yield utils.sendMailQ(
        key.userEmail,
        'Information about your BitGo backup key',
        'newkeytemplate',
        {
          pub: key.pub,
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

  const response = {
    masterKey: masterKey.pub,
    path: key.path,
    userEmail: key.userEmail,
    custom: key.custom,
    masterKeySig: masterKey.signature,
    pub: key.pub
  }

  return response;
});
