process.config = require('../config');

const Promise = require('bluebird');
const co = Promise.coroutine;
const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const pjson = require('../package.json');
const fs = require('fs');
const csvParser = require('csv-parse');
const prova = require('prova-lib');

const db = require('./db.js');
const MasterKey = require('./models/masterkey.js');
const WalletKey = require('./models/walletkey.js');

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
  [ 'file' ],
  {
    action: 'store',
    help: 'path to a CSV list of public keys'
  }
);

const deriveKeyCommand = subparsers.addParser('derive', { addHelp: true });
deriveKeyCommand.addArgument(
  [ 'master' ],
  {
    action: 'store',
    help: 'xpub of the master key (starts with "xpub")'
  }
);
deriveKeyCommand.addArgument(
  [ 'path' ],
  {
    action: 'store',
    help: 'derivation path of the wallet key (starts with "m/")'
  }
);

const verificationParser = subparsers.addParser('verification', { addHelp: true });
const verificationCommands = verificationParser.addSubparsers({
  title: 'verification commands',
  dest: 'cmd2'
});

const getVerificationCommand = verificationCommands.addParser('get', { addHelp: true });
getVerificationCommand.addArgument(
  ['xpub'],
  {
    action: 'store',
    help: 'public key of the wallet (starts with "xpub")'
  }
);

const setVerificationCommand = verificationCommands.addParser('set', { addHelp: true });
setVerificationCommand.addArgument(
  ['xpub'],
  {
    action: 'store',
    help: 'public key of the wallet (starts with "xpub")'
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

const validateXpub = function(xpub) {
  const isValidXpub = /^xpub[1-9a-km-zA-HJ-Z]{107}$/.test(xpub);

  if (!isValidXpub) {
    console.log(`Xpub ${xpub} is not a valid extended public key.`);
  }

  return isValidXpub;
}

const saveKeys = co(function *(xpubs) {
  const xpubDocs = xpubs.filter(validateXpub).map((xpub) => ({
    xpub: xpub,
    keyCount: 0
  }));

  if (xpubDocs.length === 0) {
    console.log('No valid public keys. Please make sure all public keys begin with "xpub" and are 111 characters in length.');
    return;
  }

  console.log(`Found ${xpubDocs.length} valid public keys. Pushing to database.`);

  try {
    yield MasterKey.insertMany(xpubDocs);
    console.log('Successfully imported public keys.');

    const totalKeys = yield MasterKey.estimatedDocumentCount();
    const availableKeys = yield MasterKey.countDocuments({ coin: null, customerId: null });

    console.log(`New capacity: ${availableKeys} available keys out of ${totalKeys} total keys.`);
  } catch (e) {
    console.log(e.message);
    console.log('FAILED to import all public keys. This is usually caused by trying to import a public key that already exists in the database.');
  }
});

const handleImportKeys = co(function *(args) {
  const path = args.file;
  if (path === null) {
    throw new Error('please specify the path to a CSV file containing the public keys to import');
  }

  let xpubs = [];

  fs.createReadStream(path)
    .pipe(csvParser())
    .on('data', function(xpub) {
      xpubs.push(xpub);
    })
    .on('end', co(function *() {
      xpubs = _.flatten(xpubs); // the CSV parser creates a 2d array of elements if multiple lines are present
      yield saveKeys(xpubs);
    }));
});

const deriveKey = function(masterKey, derivationPath) {
  const masterNode = prova.HDNode.fromBase58(masterKey);

  return masterNode.derivePath(derivationPath).toBase58();
};

const handleDeriveKey = function(args) {
  try {
    const childKey = deriveKey(args.master, args.path);
    console.log(` = ${childKey}`);
  } catch (e) {
    console.log(e.message);
  }
};

const handleVerificationGet = co(function *(args) {
  const xpub = args.xpub;

  const key = yield WalletKey.findOne({ xpub }).lean();

  if (key === null) {
    console.log(`Unable to find wallet key: ${xpub}`);
    return;
  }

  // if there are multiple lines, this aligns each line under the first line
  const formattedVerificationInfo = key.verificationInfo.replace(/\n/g, '\n\t\t\t');

  console.log(`==== VERIFICATION INFO FOR KEY ${xpub} ====`);
  console.log(`User Email:\t\t${key.userEmail}`);
  console.log(`Verification Info:\t${formattedVerificationInfo}`);
});

const handleVerificationSet = co(function *(args) {
  const key = yield WalletKey.findOne({ xpub: args.xpub });

  if (key === null) {
    console.log(`Unable to find wallet key: ${args.xpub}`);
    return;
  }

  key.set('verificationInfo', args.info.join(' '));

  try {
    yield key.save();
    console.log(`Successfully updated verification info for key ${args.xpub}`);
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

const run = co(function *() {
  const args = parser.parseArgs();

  switch (args.cmd) {
    case 'import':
      yield handleImportKeys(args);
      break;
    case 'derive':
      yield handleDeriveKey(args);
      break;
    case 'verification':
      yield handleVerification(args);
      break;
  }
});

// For admin script and unit testing of functions
module.exports = { run, validateXpub, deriveKey };
