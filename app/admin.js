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
const bitgo = require('bitgo');
const bitcoin = bitgo.bitcoin;
const db = require('./db.js');
const MasterKey = require('./models/masterkey.js');
const signingTool = require('./sign.js');
const WalletKey = require('./models/walletkey.js');
const utils = require('./utils');

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
  ['outputprefix'],
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
            'format that is output by "initkey"'
    }
);

generateFromShards.addArgument(
    ['outputprefix'],
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
    'Note: To generate a master key for non-Stellar coins, please use "initkey"'
});

createSeed.addArgument(
    ['outputprefix'],
    {
        action: 'store',
        help: 'prefix of the .json output file to store the newly generated seed'
    }
);

const initKey = subparsers.addParser('initkey', {
    addHelp: true,
    description: "Generates a master key, splits it into encrypted shards, and stores it as a file"
});

initKey.addArgument(
    [ 'outputprefix' ],
    {
        action: 'store',
        help: 'prefix of the .json output file to store the newly generated encrypted key shards'
    }
);

initKey.addArgument(
    ['--type'],
    {
        action: 'store',
        defaultValue: 'shards',
        help: 'pass in type "xlm" to create an xlm seed. note that xlm seeds are stored in a non-encrypted .json file'
    }
);

const recoverKeys = subparsers.addParser('recover', {
    addHelp: true,
    description: "Recover a key from an encrypted shares .json file (one that was generated from 'initkey'). WARNING!!!! THIS WILL PRINT A PRIVATE KEY TO THE CONSOLE!!!"
});
recoverKeys.addArgument(
    ['inputfile'],
    {
        action: 'store',
        help: 'the name of the file that contains encrypted shares of a private key. this should be a json file in the' +
            'format that is output by "initkey"'
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
    assertFileDoesNotExist(args.outputprefix + '.json');
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
 * args.outputprefix (the prefix of the .json file name that will be created)
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

  const output = args.outputprefix + '.json';

  console.log(`Keys generated, saving to ${output}`);
  fs.writeFileSync(output, JSON.stringify(keys, null, 2));
};

/**
 * This function is only used to generate an XLM seed right now
 */
const handleGenerateHDSeed = function(args) {
  const XLM_SEED_LENGTH = 64;
  const seed = crypto.randomBytes(XLM_SEED_LENGTH).toString('hex');
  let filename = args.outputprefix + '.json';
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


const handleInitKey = co(function *(args) {
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
    const filename = input.outputprefix + '.json';
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
    decryptShardedKey(args, printKey);
});


/**
 * Decrypt a key from the JSON file produced by initkey
 * Note: by default, initkey only produces one key, so this will usually recover a list containing 1 key.
 *
 * This code has been refactored from a function that orignally decrypted a file containing multiple keys
 *
 */
const decryptShardedKey = function(args, onFinish) {
    const self = this;
    const input = new utils.UserInput(args);
    input.keys = '0'; // this just tells it to get the first key in the list (there should only be one key there)
    const passwords = [];
    let keysToRecover;

    console.log('\nDecrypting key from ' + input.inputfile );

    /**
     * Get a password from the user, testing it against encrypted shares
     * to determine which (if any) index of the shares it corresponds to.
     *
     * @param   {Number} i      index of the password (0..n-1)
     * @param   {Number} n      total number of passwords needed
     * @param   {String[]}   shares   list of encrypted shares
     * @returns {Promise}
     */
    const getPassword = function(i, n, shares) {
        if (i === n) {
            return;
        }
        const passwordName = 'password' + i;
        return input.getPassword(passwordName, 'Password ' + i + ': ', false)()
            .then(function() {
                const password = input[passwordName];
                let found = false;
                shares.forEach(function(share, shareIndex) {
                    try {
                        sjcl.decrypt(password, share);
                        if (!passwords.some(function(p) { return p.shareIndex === shareIndex; })) {
                            passwords.push({ shareIndex: shareIndex, password: password });
                            found = true;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });
                if (found) {
                    return getPassword(i + 1, n, shares);
                }
                console.log('bad password - try again');
                delete input[passwordName];
                return getPassword(i, n, shares);
            });
    };

    return Q().then(function() {
        if (args.verifyonly) {
            console.log('Verify Split Keys');
        }
    })
        //.then(input.getVariable('file', 'Input file (JSON): '))
        //.then(input.getVariable('keys', 'Comma-separated list of key indices to recover: '))
        // key indices has been deprecated ^
        .then(function() {
            // Grab the list of keys from the file
            const json = fs.readFileSync(input.inputfile);
            const keys = JSON.parse(json);

            // Determine and validate the indices of the keys to recover
            let indices = input.keys.split(',')
                .map(function(x) { return parseInt(x, 10); })
                .filter(function(x) { return !isNaN(x); });
            indices = _.uniq(indices).sort(function(a, b) { return a - b; });
            if (!indices.length) {
                throw new Error('no indices');
            }
            if (indices[0] < 0 || indices[indices.length - 1] >= keys.length) {
                throw new Error('index out of range: ' + keys.length + ' keys in file');
            }

            // Get the keys to recover
            keysToRecover = keys.filter(function(key, index) {
                return indices.indexOf(index) !== -1;
            });

            const firstKey = keysToRecover[0];

            console.log('\nYou must now enter your encryption passwords. Note that the order does not matter for these passwords. You only must enter ' + firstKey.m + ' of the ' + firstKey.n + ' passwords you created.\n');


            // Get the passwords
            return getPassword(0, firstKey.m, firstKey.seedShares);
        })
        .then(function() {
            // For each key we want to recover, decrypt the shares, recombine
            // into a seed, and produce the xprv, validating against existing xpub.
            const recoveredKeys = keysToRecover.map(function(key) {
                const shares = passwords.map(function(p, i) {
                    console.log('Decrypting Key Part #' + i);
                    return sjcl.decrypt(p.password, key.seedShares[p.shareIndex]);
                });
                let seed;
                if (shares.length === 1) {
                    seed = shares[0];
                } else {
                    seed = secrets.combine(shares);
                }
                const extendedKey = bitcoin.HDNode.fromSeedHex(seed);
                const xpub = extendedKey.neutered().toBase58();
                const xprv = args.verifyonly ? undefined : extendedKey.toBase58();
                if (!args.verifyonly && xpub !== key.xpub) {
                    throw new Error("xpubs don't match for key " + key.index);
                }
                return {
                    index: key.index,
                    xpub: xpub,
                    xprv: xprv
                };
            });
            if(onFinish) {
                onFinish(recoveredKeys);
            }
        });
};

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
    yield decryptShardedKey(args, afterDecryption);
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
    yield decryptShardedKey(args, afterDecryption);

});

const run = co(function *(testArgs) {
  const args = parser.parseArgs(testArgs);
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
    case 'initkey':
      yield handleInitKey(args);
      break;
    case 'recover':
      yield handleRecoverKeys(args);
      break;
    case 'generateFromShards':
      yield handleGenerateFromShards(args);
      break;
  }

  db.connection.close();
});



// For admin script and unit testing of functions
module.exports = { run, validateKey, db };
