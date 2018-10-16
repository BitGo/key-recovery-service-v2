process.config = require('../config');

const Promise = require('bluebird');
const co = Promise.coroutine;
const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const pjson = require('../package.json');
const fs = require('fs');
const crypto = require('crypto');
const Q = require('q');
const readline = require('readline');
const read = require('read');
const sjcl = require('sjcl');
const secrets = require('secrets.js-grempe');
const bitcoin = require('bitgo-utxo-lib');
const db = require('./db.js');
const MasterKey = require('./models/masterkey.js');
const signingTool = require('./sign.js');
const WalletKey = require('./models/walletkey.js');
const utils = require('./utils');
const decryptShards = require('./decryptshards.js');
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
  ['recoveryfile'],
  {
    action: 'store',
    help: 'path to the recovery request JSON file'
  }
);
signCommand.addArgument(
    ['--keyfile'],
    {
        required: false,
        action: 'store',
        help: 'path to the master key file'
    }
);
signCommand.addArgument(
    ['--type'],
    {
        action: 'store',
        defaultValue: 'xprv',
        help: 'set type to "xlm" for xlm key signings'
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
        help: 'the derivation path from the master key that corresponds to the address you wish to sign for'
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

const generateKeysCommand = subparsers.addParser('generate', { addHelp: true });
generateKeysCommand.addArgument(
  ['inputfile'],
  {
    action: 'store',
    help: 'file containing the master seed to derive hardened child keys from'
  }
);
generateKeysCommand.addArgument(
  ['outputfile'],
  {
    action: 'store',
    help: 'prefix of a new .json file to save the generated private keys to'
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
        defaultValue: 'shards',
        help: 'pass in type "xlm" to handle generation of xlm public keys'
    }
);

const generateFromShards = subparsers.addParser('generateFromShards', { addHelp: true });

generateFromShards.addArgument(
    ['inputfile'],
    {
        action: 'store',
        help: 'the name of the file that contains encrypted shards of a private key. this should be a json file in the' +
            'format that is output by "newkey"'
    }
);

generateFromShards.addArgument(
    ['outputfile'],
    {
        action: 'store',
        help: 'prefix of a new .json output file to save generated private keys to'
    }
);
generateFromShards.addArgument(
    ['-n'],
    {
        action: 'store',
        defaultValue: 100000,
        type: Number,
        help: 'number of keys to generate'
    }
);
generateFromShards.addArgument(
    ['--start'],
    {
        action: 'store',
        defaultValue: 0,
        type: Number,
        help: 'first path to derive (i.e. 0 for m/0\', or 10000 for m/10000\')'
    }
);

const createSeed = subparsers.addParser('seed', {
  addHelp: true,
  description: 'Generates a cryptographically secure random seed to be used for Stellar key derivation.\n' +
    'Note: To generate a master key for non-Stellar coins, please use "newkey"'
});

createSeed.addArgument(
    ['outputfile'],
    {
        action: 'store',
        help: 'prefix of the .json output file to store the newly generated seed'
    }
);

const newKey = subparsers.addParser('newkey', {
    addHelp: true,
    description: "Generates a master key, splits it into encrypted shards, and stores it as a file"
});

newKey.addArgument(
    [ 'outputfile' ],
    {
        action: 'store',
        help: 'prefix of the .json output file to store the newly generated encrypted key shards'
    }
);

newKey.addArgument(
    ['--type'],
    {
        action: 'store',
        defaultValue: 'shards',
        help: 'pass in type "xlm" to create an xlm seed. note that xlm seeds are stored in a non-encrypted .json file'
    }
);

const recoverKeys = subparsers.addParser('recover', {
    addHelp: true,
    description: "Recover a key from an encrypted shares .json file (one that was generated from 'newkey'). WARNING!!!! THIS WILL PRINT A PRIVATE KEY TO THE CONSOLE!!!"
});
recoverKeys.addArgument(
    ['inputfile'],
    {
        action: 'store',
        help: 'the name of the file that contains encrypted shares of a private key. this should be a json file in the' +
            'format that is output by "newkey"'
    }
);
recoverKeys.addArgument(['-v', '--verifyonly'], { action: 'storeConst', constant: 'true', help: 'verify only (do not show xprvs)' });
// recoverKeys.addArgument(['-f', '--file'], { help: 'the input file (JSON format)' });

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

  return true;
};

const saveKeys = co(function *(keys, type) {
  // this extracts the possible values directly from the Mongoose schema, which is considered the most accurate set of possible values
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
    console.log('FAILED to import all public keys. This is usually caused by trying to import a public key that already exists in the database.');
  }
});

const handleImportKeys = co(function *(args) {
  const path = args.file;
  const type = args.type;

  if (path === null) {
    throw new Error('please specify the path to a CSV file containing the public keys to import');
  }

  const keys = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }));

  yield saveKeys(keys, type);
});

const handleDeriveKey = function(args) {
  try {
    const childKey = utils.deriveChildKey(args.master, args.path, args.type, false);
    console.log(` = ${childKey}`);
  } catch (e) {
    console.log(e.message);
  }
};

const handleGenerateKeys = function(args) {
    if(args.type == 'xlm') {
        handleGenerateXLMKeys(args);
    } else {
        handleGenerateFromShards(args);
    }
}

const handleGenerateXLMKeys = function(args) {
    assertFileDoesNotExist(args.outputfile);
    args.master = getSeedFromXLMFile(args.inputfile);
    generatePubKeys(args);
}

const getSeedFromXLMFile = function(filename) {
    const input = fs.readFileSync(filename);
    const inputJson = JSON.parse(input);
    if (!inputJson.seed) {
        throw new Error('Malformed input file. File JSON does not have a "seed" property');
    }
    return inputJson.seed;
}

/**
 * generatePubKeys will generate n hardened public keys
 * @param args
 * args.n (number of public keys to generate)
 * args.start (the path index to start generating keys at)
 * args.master (the master private key from which all hardened keys will be derived)
 * args.type (should be either xprv or xlm)
 * args.outputfile (the prefix of the .json file name that will be created)
 */
const generatePubKeys = function(args) {
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

  const output = args.outputfile;

  console.log(`Keys generated, saving to ${output}`);
  fs.writeFileSync(output, JSON.stringify(keys, null, 2));
};

/**
 * This function is only used to generate an XLM seed right now
 */
const handleGenerateHDSeed = function(args) {
  const XLM_SEED_LENGTH = 64;
  const seed = crypto.randomBytes(XLM_SEED_LENGTH).toString('hex');
  let filename = args.outputfile;
  const seedJson = { seed: seed };

  assertFileDoesNotExist(filename);
  fs.writeFileSync(filename, JSON.stringify(seedJson, null, 2));
  console.log("\nGenerated a random seed and stored in the file: " + filename + "\n");
};

const handleVerificationGet = co(function *(args) {
  const pub = args.pub;

  const key = yield WalletKey.findOne({ pub }).lean();

  if (key === null) {
    throw new Error(`Unable to find wallet key: ${pub}`);
  }

  if (_.isUndefined(key.verificationInfo)) {
    key.verificationInfo = '<N/A>'
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

const assertFileDoesNotExist = function(filename) {
    try {
        fs.openSync(filename, 'r');
    } catch(err) {
        return;
    }
    throw new Error('\nFile named ' + filename + ' already exists. Please remove the old file, or choose a new filename to write to.\n');
}


const handleNewKey = co(function *(args) {
    if(args.type === 'xlm') {
        handleGenerateHDSeed(args);
    } else {
        yield handleInitShardedKey(args);
    }
});


/**
 * Generate a random BIP32 root key, from a random 256-bit
 * seed. The seed is split using Shamir Secret Sharing Scheme
 * (SSSS), such that any M of N of the shares can be recombined to
 * produce the seed. The SSSS shares are encrypted with N separate
 * passwords, intended to be provided at run-time by separate individuals.
 */
const handleInitShardedKey = function(args) {
    const self = this;
    const input = new utils.UserInput(args);
    const filename = input.outputfile;
    assertFileDoesNotExist(filename);
    const getPassword = function(i, n) {
        if (i === n) {
            return;
        }
        const passwordName = 'password' + i;
        return input.getPassword(passwordName, 'Password for share ' + i + ': ', true)()
            .then(function() {
                return getPassword(i + 1, n);
            });
    };

    return Q().then(function() {
        console.log('Generate Split Keys');
        console.log();
    })
        .then(input.getVariable('enter',"You are about to generate a key, press enter to continue\n"))
        .then(input.getIntVariable('n', 'Number of shares per key (N): ', true, 1, 10))
        .then(function() {
            let mMin = 2;
            if (input.n === 1) {
                mMin = 1;
            }
            return input.getIntVariable('m', 'Number of shares required to restore key (M <= N): ', true, mMin, input.n)();
        })
        .then(input.getVariable('entropy', 'User supplied entropy string (optional): '))
        .then(function() {
            if (input.entropy) {
                utils.addUserEntropy(input.entropy);
            }
            console.log("\n\nYou will now enter a password for each key share. These passwords must all be unique.");
            console.log("\n\nAlso note, the order in which you enter these passwords will not matter when decrypting the file.");
            return getPassword(0, input.n);

        })
        .then(function() {
            const keys = _.range(0, 1).map(function(index) {
                const key = utils.genSplitKey(input);
                if (index % 10 === 0) {
                    console.log('Generating key ' + index);
                }
                return {
                    index: index,
                    xpub: key.xpub,
                    m: key.m,
                    n: key.n,
                    seedShares: key.seedShares
                };
            });
            fs.writeFileSync(filename, JSON.stringify(keys, null, 2));
            console.log('Wrote ' + filename);
            const csvRows = keys.map(function(key) {
                return key.index + ',' + key.xpub;
            });
        });
};

const handleRecoverKeys = co(function *(args) {
   console.log('\n\nWARNING!! This will print a private key to the console. Continue at your own risk, or CTRL-C to exit\n');
    const printKey = function(recoveredKeys) {
        console.log(recoveredKeys);
    }
    decryptShards.decryptShardedKey(args, printKey);
});


/**
 * Given a file of encrypted key shards, generate a bunch of hardened xpubs
 */
const handleGenerateFromShards = co(function *(args) {
    // must decrypt the file using handleRecoverKeys and a callback
    const afterDecryption = function(keys) {
        console.log('\nKeys successfully decrypted, now we will generate ' + args.n + ' hardened public keys.\n\n');
        args.master = keys[0].xprv;
        args.type = 'xprv';
        generatePubKeys(args);
    };
    yield decryptShards.decryptShardedKey(args, afterDecryption);
});

const handleSignPrep = co(function *(args) {
    if(args.key) {
        signingTool.handleSign(args);
        return;
    }
    if(!args.keyfile) {
        throw new Error('Please include either a --key or --keyfile to sign the transaction with');
    }

    // if we get here, the user has passed in a keyfile to sign the transaction
    if(args.type === 'xlm') {
        const xlmmaster = getSeedFromXLMFile(args.keyfile);
        args.key = utils.deriveChildKey(xlmmaster, args.path, args.type, false);
        signingTool.handleSign(args);
        return;
    }

    // if we get here, the user has passed in a non-xlm keyfile that needs to be decrypted to extract the private key

    if(!args.path) {
        throw new Error('You must specify a derivation path for this recovery');
    }

    const afterDecryption = function(keys) {
        console.log('\nKey successfully decrypted. Ready to sign. \n');
        args.key = utils.deriveChildKey(keys[0].xprv, args.path, args.type, false);
        args.type = 'xprv';
        signingTool.handleSign(args);
    }
    args.inputfile = args.keyfile;
    yield decryptShards.decryptShardedKey(args, afterDecryption);

});

const run = co(function *(testArgs) {
  const args = parser.parseArgs(testArgs);
  if(args.outputfile) {
      args.outputfile = makeItJSON(args.outputfile);
  }
  switch (args.cmd) {
    case 'import':
      yield handleImportKeys(args);
      break;
    case 'sign':
      yield handleSignPrep(args);
      break;
    case 'derive':
      handleDeriveKey(args);
      break;
    case 'generate':
      handleGenerateKeys(args);
      break;
    case 'seed':
      handleGenerateHDSeed(args);
      break;
      // Note: verification will not be possible in an offline environment, because it needs to talk to the KRS's database, which will be online
    case 'verification':
      yield handleVerification(args);
      break;
    case 'newkey':
      yield handleNewKey(args);
      break;
    case 'recover':
      console.log('recover has been disabled');
      // yield handleRecoverKeys(args);
      break;
    case 'generateFromShards':
      yield handleGenerateFromShards(args);
      break;
  }

  db.connection.close();
});

/**
 * Takes in a filename.
 * If it is a .json file, just returns the file
 * If it does not end with .json, it appends .json to the end of the filename and returns it
 */
const makeItJSON = function(filename) {
    if(!filename.endsWith('.json')) {
        return filename + '.json';
    }
    return filename;
}


// For admin script and unit testing of functions
module.exports = { run, validateKey, db };
