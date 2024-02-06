process.config = require('../config');

const Promise = require('bluebird');
const co = Promise.coroutine;
const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const pjson = require('../package.json');
const fs = require('fs');
const crypto = require('crypto');

let db, MasterKey, WalletKey;
const signingTool = require('./sign.js');
const utils = require('./utils');
const bitcoinMessage = require('bitcoinjs-message');

const parser = new ArgumentParser({
  version: pjson.version,
  addHelp: true,
  description: 'Key Recovery Service admin tool'
});

const subparsers = parser.addSubparsers({
  title: 'commands',
  dest: 'cmd'
});

const importKeys = subparsers.addParser('import', { addHelp: true });
importKeys.addArgument(
  ['file'],
  {
    action: 'store',
    help: 'path to a list of public keys generated from admin.js generate'
  }
);
importKeys.addArgument(
  ['--type'],
  {
    action: 'store',
    help: 'type of key to import (xpub for most coins, xlm for Stellar keys)',
    defaultValue: 'xpub',
    choices: ['xpub', 'xlm']
  }
);

const signCommand = subparsers.addParser('sign', { addHelp: true });
signCommand.addArgument(
  ['file'],
  {
    action: 'store',
    help: 'path to the recovery request JSON file'
  }
);
signCommand.addArgument(
  ['--key'],
  {
    action: 'store',
    required: false, // can be typed during the signing process to avoid leaving the xprv in the shell history
    help: 'private key to sign the transaction with'
  }
);
signCommand.addArgument(
  ['--path'],
  {
    action: 'store',
    required: false,
    help: 'optional derivation path to derive from the given key'
  }
);
signCommand.addArgument(
  ['--confirm'],
  {
    action: 'storeTrue',
    help: 'will not ask for confirmation before signing (be careful!)'
  }
);

const verificationParser = subparsers.addParser('verification', { addHelp: true });
const verificationCommands = verificationParser.addSubparsers({
  title: 'verification commands',
  dest: 'cmd2'
});

const getVerificationCommand = verificationCommands.addParser('get', { addHelp: true });
getVerificationCommand.addArgument(
  ['pub'],
  {
    action: 'store',
    help: 'public key of the wallet'
  }
);

const setVerificationCommand = verificationCommands.addParser('set', { addHelp: true });
setVerificationCommand.addArgument(
  ['pub'],
  {
    action: 'store',
    help: 'public key of the wallet'
  }
);
setVerificationCommand.addArgument(
  ['info'],
  {
    action: 'store',
    nargs: '+',
    help: 'verification information to store with the wallet\'s backup key'
  }
);

const recoveryInfoCommand = subparsers.addParser('recoveryInfo', { addHelp: true });
recoveryInfoCommand.addArgument(
  ['file'],
  {
    action: 'store',
    help: 'the path to the recovery file that bitgo provided'
  }
);

const generateKeysCommand = subparsers.addParser('generate', { addHelp: true });
generateKeysCommand.addArgument(
  ['master'],
  {
    action: 'store',
    help: 'master private key to derive hardened child keys from'
  }
);
generateKeysCommand.addArgument(
  ['output'],
  {
    action: 'store',
    help: 'path of file to save generated private keys to'
  }
);
generateKeysCommand.addArgument(
  ['-n'],
  {
    action: 'store',
    defaultValue: 100000,
    type: Number,
    help: 'number of keys to generate'
  }
);
generateKeysCommand.addArgument(
  ['--start'],
  {
    action: 'store',
    defaultValue: 0,
    type: Number,
    help: 'first path to derive (i.e. 0 for m/0\', or 10000 for m/10000\')'
  }
);
generateKeysCommand.addArgument(
  ['--type'],
  {
    action: 'store',
    defaultValue: 'xprv',
    choices: ['xprv', 'xlm'],
    help: 'type of key to generate ("xprv" for coins on the secp256k1 curve / "xlm" for Stellar)',
    required: false
  }
);

subparsers.addParser('seed', {
  addHelp: true,
  description: 'Generates a cryptographically secure random seed to be used for Stellar key derivation.\n'
    + 'Note: To generate a master key for non-Stellar coins, please install BitGo CLI and run "bitgo newkey"'
});

const deriveKeyCommand = subparsers.addParser('derive', { addHelp: true });
deriveKeyCommand.addArgument(
  ['master'],
  {
    action: 'store',
    help: 'xpub of the master key (starts with "xpub")'
  }
);
deriveKeyCommand.addArgument(
  ['path'],
  {
    action: 'store',
    help: 'derivation path of the wallet key (starts with "m/")'
  }
);
deriveKeyCommand.addArgument(
  ['--type'],
  {
    action: 'store',
    help: 'type of key to derive from (xlm for deriving from a Stellar seed)',
    defaultValue: 'xpub',
    choices: ['xpub', 'xprv', 'xlm']
  }
);

const validateKey = function(key, type) {
  const xpubRegex = /^xpub[1-9a-km-zA-HJ-Z]{107}$/;
  const xlmRegex = /^G[2-7A-Z]{55}$/;

  if (type === 'xpub' && !xpubRegex.test(key.pub)) {
    console.log(`BIP32 xpub ${key.pub} is not a valid extended public key.`);
    return false;
  }

  if (type === 'xlm' && !xlmRegex.test(key.pub)) {
    console.log(`Stellar Lumens key ${key.pub} is not a valid public key.`);
    return false;
  }

  // if we have provided a verificationPub, then check the key signature
  if (process.config.verificationPub) {

    if (!key.signature) {
      console.log(`Key ${key.pub} has a verification public key but no signature.`);
      return false;
    }

    let validSig = false;
    try {
      validSig = bitcoinMessage.verify(key.pub, process.config.verificationPub, key.signature);
    } catch (err) {
      console.log(`There was an error when verifying key ${key.pub}: ` + err.message);
      return false;
    }

    if (!validSig) {
      console.log(`Invalid signature detected on key ${key.pub}`);
      return false;
    }
  }

  return true;
};

const saveKeys = co(function *(keys, type) {
  // this extracts the possible values directly from the Mongoose schema,
  // which is considered the most accurate set of possible values
  const validTypes = MasterKey.schema.path('type').enumValues;

  if (!validTypes.includes(type)) {
    console.log(`Invalid key type ${type}.`);
    return;
  }

  const keyDocs = keys
    .filter( key => validateKey(key, type))
    .map( key => ({
      type: type,
      pub: key.pub,
      path: key.path,
      signature: key.signature,
      keyCount: 0
    }));

  if (keyDocs.length === 0) {
    console.log('No valid public keys. Please re-generate and try again.');
    return;
  }

  console.log(`Found ${keyDocs.length} valid public keys. Pushing to database.`);

  try {
    yield MasterKey.insertMany(keyDocs);
    console.log('Successfully imported public keys.');

    const totalKeys = yield MasterKey.countDocuments({ type: type });
    const availableKeys = yield MasterKey.countDocuments({ type: type, coin: null, customerId: null });

    console.log(`New capacity: ${availableKeys} available ${type} keys out of ${totalKeys} total ${type} keys.`);
  } catch (e) {
    console.log(e.message);
    console.log('FAILED to import all public keys. '
      + 'This is usually caused by trying to import a public key that already exists in the database.');
  }
});

const handleImportKeys = co(function *(args) {
  const path = args.file;
  const type = args.type;

  if (path === null) {
    throw new Error('please specify the path to a CSV file containing the public keys to import');
  }

  const file = yield fs.readFile(path, { encoding: 'utf8' });

  let keys = JSON.parse(file);

  keys = formatKeysByType(keys, type);

  yield saveKeys(keys, type);
});

/**
 * This function handles a new type of key-import format
 * For example, a key can be imported as such:
 * {
 *   pub: "xpub20412049182341234"
 *   xlmpub: "GSLKJASDFJASLFASDFAS"
 *   signature: "IK/alkjELASJFLAKJSDFLAKSFASDFW=="
 *   xlmSignature: "KOPASIK------PSDIFAPSDFOAF"
 *   path: "100"
 * }
 * If this key comes in, we can save it either as type xpub or xlm
 * (depending on what the admin specifies on the command line)
 * If the above key is imported as type 'xlm', we will change it to the following format:
 * {
 *   pub: "GSLKJASDFJASLFASDFAS"
 *   signature: "KOPASIK------PSDIFAPSDFOAF"
 *   path: "100"
 * }
 * Notice that we replaced the pub and signature fields with the XLM info.
 * Alternatively, if the key is specified to be an xpub, we would just remove the XLM info and continue as normal
 */
const formatKeysByType = function(keys, type) {
  // if using the old format, don't do anything here, just return the keys
  if (!keys[0].xlmpub) {
    return keys;
  }
  const formattedkeys = [];
  _.forEach(keys, function(key) {
    formattedkeys.push({
      pub: type === 'xlm' ? key.xlmpub : key.pub,
      signature: type === 'xlm' ? key.xlmSignature : key.signature,
      path: key.path
    });
  });
  return formattedkeys;
};

const handleDeriveKey = function(args) {
  try {
    const childKey = utils.deriveChildKey(args.master, args.path, args.type, false);
    console.log(` = ${childKey}`);
  } catch (e) {
    console.log(e.message);
  }
};

const handleGenerateKeys = function(args) {
  const keys = [];

  for (let i = args.start; i < args.start + args.n; i++) {
    const path = 'm/' + i + '\'';
    console.log(`Generating key ${path} of m/${args.start + args.n - 1}'`);

    const key = {
      pub: utils.deriveChildKey(args.master, path, args.type, true),
      path: path
    };

    keys.push(key);
  }

  console.log(`Keys generated, saving to ${args.output}`);
  fs.writeFileSync(args.output, JSON.stringify(keys, null, 2));
};

const handleGenerateHDSeed = function() {
  const XLM_SEED_LENGTH = 64;

  console.log(crypto.randomBytes(XLM_SEED_LENGTH).toString('hex'));
};

const handleVerificationGet = co(function *(args) {
  const pub = args.pub;

  const key = yield WalletKey.findOne({ pub }).lean();

  if (key === null) {
    throw new Error(`Unable to find wallet key: ${pub}`);
  }

  if (_.isUndefined(key.verificationInfo)) {
    key.verificationInfo = '<N/A>';
  }

  // if there are multiple lines, this aligns each line under the first line
  const formattedVerificationInfo = key.verificationInfo.replace(/\n/g, '\n\t\t\t');

  console.log();
  console.log(`Key:\t\t\t${key.pub}`);
  console.log(`Master Key:\t\t${key.masterKey}`);
  console.log(`User Email:\t\t${key.userEmail}`);
  console.log(`Verification Info:\t${formattedVerificationInfo}`);
  if (key.custom) {
    console.log('Custom data:');
    console.log(JSON.stringify(key.custom, null, 2));
  }
});

const handleVerificationSet = co(function *(args) {
  const key = yield WalletKey.findOne({ pub: args.pub });

  if (key === null) {
    console.log(`Unable to find wallet key: ${args.pub}`);
    return;
  }

  key.set('verificationInfo', args.info.join(' '));

  try {
    yield key.save();
    console.log(`Successfully updated verification info for key ${args.pub}`);
  } catch (e) {
    console.log(e.message);
    console.log('FAILED to update verification info on key.');
  }
});

const handleVerification = co(function *(args) {
  switch (args.cmd2) {
    case 'get':
      yield handleVerificationGet(args);
      break;
    case 'set':
      yield handleVerificationSet(args);
      break;
  }
});

const handleRecoveryInfo = co(function *(args) {
  const json = JSON.parse(fs.readFileSync(args.file));
  const pub = json.backupKey;
  const walletkey = yield WalletKey.findOne({ pub });
  const masterkey = yield MasterKey.findOne({ pub: walletkey.masterKey });
  json.masterkey = masterkey.pub;
  json.masterkeypath = masterkey.path;
  json.walletkeypath = walletkey.path;
  const filename = args.file.substring(0, args.file.length - 5) + '-prepared.json';
  console.log('got info... writing file ' + filename);
  fs.writeFileSync(filename, JSON.stringify(json, null, 2));
  console.log('done.');
});

const requireDB = function() {
  MasterKey = require('./models/masterkey.js');
  WalletKey = require('./models/walletkey.js');
  db = require('./db.js');
};

const run = co(function *(testArgs) {
  const args = parser.parseArgs(testArgs);

  switch (args.cmd) {
    case 'import':
      requireDB();
      yield handleImportKeys(args);
      break;
    case 'sign':
      yield signingTool.handleSign(args);
      break;
    case 'derive':
      handleDeriveKey(args);
      break;
    case 'generate':
      handleGenerateKeys(args);
      break;
    case 'seed':
      handleGenerateHDSeed();
      break;
    case 'verification':
      requireDB();
      yield handleVerification(args);
      break;
    case 'recoveryInfo':
      requireDB();
      yield handleRecoveryInfo(args);
  }

  if (db && db.connection) {
    db.connection.close();
  }
});

// For admin script and unit testing of functions
module.exports = { run, validateKey, saveKeys, db, requireDB };
