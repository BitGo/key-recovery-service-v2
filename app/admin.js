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
const signingTool = require('./sign.js');

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

const signCommand = subparsers.addParser('sign', { addHelp: true });
signCommand.addArgument(
  ['file'],
  {
    action: 'store',
    help: 'path to the recovery request JSON file'
  }
);
signCommand.addArgument(
  ['key'],
  {
    action: 'store',
    required: false, // can be typed during the signing process to avoid leaving the xprv in the shell history
    help: 'private key to sign the transaction with'
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

const run = co(function *() {
  const args = parser.parseArgs();

  switch (args.cmd) {
    case 'import':
      yield handleImportKeys(args);
      break;
    case 'sign':
      signingTool.handleSign(args);
      break;
  }
});

// For admin script and unit testing of functions
module.exports = { run, validateXpub, deriveKey };
