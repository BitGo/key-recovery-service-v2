process.config = require('../config');

const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('fs');
const Q = require('q');
const secrets = require('secrets.js-grempe');
const utils = require('./utils');
const sjcl = require('sjcl');
const bitcoin = require('bitgo-utxo-lib');
const prompt = require('prompt-sync')({sigint: true,history: require('prompt-sync-history')()});



/**
 * Decrypt a key from the JSON file produced by newkey
 * Note: by default, newkey only produces one key, so this will usually recover a list containing 1 key.
 *
 * This code has been refactored from a function that orignally decrypted a file containing multiple keys
 *
 */
exports.decryptShardedKey = function(args, onFinish) {
    const self = this;
    const input = new utils.UserInput(args);
    input.keys = '0'; // this just tells it to get the first key in the list (there should only be one key there)
    const passwords = [];
    let keysToRecover;

    // Replaced input.inputfile with an aggregated file

    // prompt users to upload shards one by one, then construct one large encrypted file that looks like the

    // console.log('\nDecrypting key from ' + input.inputfile );

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
            // const json = fs.readFileSync(input.inputfile)
            // const keys = JSON.parse(json);

            const keys = uploadKeyShares(false);

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
                    xprv: xprv,
                    seed: seed
                };
            });
            if(onFinish) {
                onFinish(recoveredKeys);
            }
        });
};

/**
 * Prompt the user to upload all the key shares from separate files
 * @param all : when true, the prompt will continue until all N shares are uploaded.
 * When false, the prompt will stop once M shares have been uploaded.
 *
 * returns a list containing 1 json object
 */
const uploadKeyShares = function(all) {
    console.log("\nIt is now time to upload the key shares you wish to use.\n");
    const currentPrvs= [];
    let m = null;
    let n = null;
    let xpub = null;
    while(true) {
        const inputfile = prompt("Enter the file path containing a key share: ");
        try {
            const file = fs.readFileSync(inputfile);
            const json = JSON.parse(file);

            // Enforce file contents are correct
            if(!json.m) throw new Error('File does not contain the required field: m');
            if(!json.n) throw new Error('File does not contain the required field: n');
            if(!json.xpub) throw new Error('File does not contain the required field: xpub');
            if(!json.xprv) throw new Error('File does not contain the required field: xprv');


            // Sanity check that share matches previous shares uploaded just now
            if(m) {
                if (json.m !== m) throw new Error('m does not match previous share');
                if(json.n !== n) throw new Error('n does not match previous share');
                if(json.xpub !== xpub) throw new Error('xpub does not match previous share');
            } else {
                m = json.m;
                n = json.n;
                xpub = json.xpub;
            }

            // Make sure not uploading a duplicate share
            if(currentPrvs.includes(json.xprv)) throw new Error('tried to upload a duplicate share');

            currentPrvs.push(json.xprv);

            console.log('\nSuccessfully uploaded ' + inputfile + '\n');

            // if we've uploaded n shares, break the loop
            if(currentPrvs.length === n) break;

            // if we've uploaded m shares, and that's all the user wants, break the loop
            if(!all && currentPrvs.length === m) break;

        } catch (err) {
            console.log("There was an error reading the file: " + err.message);
        }
    }

    // Now construct and return the json with all the shares
    return [{
        index: 0,
        xpub: xpub,
        m: m,
        n: n,
        seedShares:currentPrvs
    }]
}
