const Q = require('q');
const _ = require('lodash');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const jsrender = require('jsrender');
const readline = require('readline');
const prova = require('prova-lib');
const stellar = require('stellar-base');
const stellarHd = require('stellar-hd-wallet');
const sjcl = require('sjcl');
const read = require('read');
const secrets = require('secrets.js-grempe');
const crypto = require('crypto');
const bitgo = require('bitgo');
const bitcoin = bitgo.bitcoin;


const rippleParse = require('ripple-binary-codec');
const rippleKeypairs = require('ripple-keypairs');

process.config = require('../config');

let sendMail;
if (process.config.mail) {
  // create reusable transporter object using SMTP transport
  const mailTransport = nodemailer.createTransport(smtpTransport(process.config.mail));
  sendMail = Q.nbind(mailTransport.sendMail, mailTransport);
}

// Error response container for handling by the promise wrapper
exports.ErrorResponse = function(status, result) {
  const err = new Error('');
  err.status = status;
  err.result = result;
  return err;
};

// Promise handler wrapper to handle sending responses and error cases
exports.promiseWrapper = function(promiseRequestHandler) {
  return function (req, res, next) {
    Q.fcall(promiseRequestHandler, req, res, next)
    .then(function (result) {
      var status = 200;
      if (result.__redirect) {
        res.redirect(result.url);
        status = 302;
      } else if (result.__render) {
        res.render(result.template, result.params);
      } else {
        res.status(status).send(result);
      }
    })
    .catch(function(caught) {
      let err;
      if (caught instanceof Error) {
        err = caught;
      } else if (typeof caught === 'string') {
        err = new Error("(string_error) " + caught);
      } else {
        err = new Error("(object_error) " + JSON.stringify(caught));
      }

      const message = err.message || 'local error';
      // use attached result, or make one
      const result = err.result || { error: message };
      const status = err.status || 500;
      if (!(status >= 200 && status < 300)) {
        // console.log('error %s: %s', status, err.message);
      }
      if (status === 500) {
        console.log(err.stack);
      }
      res.status(status).send(result);
    })
    .done();
  };
};

exports.sendMailQ = function(toEmail, subject, template, templateParams, attachments) {
  // If mail not configured, don't send
  if (!process.config.mail) {
    return Q();
  }

  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: process.config.mail.fromemail,
    to: toEmail,
    subject: subject, // Subject line
    attachments: attachments
  };

  mailOptions.html = jsrender.templates(`./app/templates/${template}.html`).render(templateParams);

  // send mail with defined transport object
  return sendMail(mailOptions);
};

/** deriveChildKey
 *
 * returns the derived key as a string
 *
 * ( note: for xlm: 'neuter' parameter effectively specifies whether to return the public key or the secret
 *  if neuter == true, it returns the xlm public key
 *  if neuter == false, it returns the xlm secret )
 */

exports.deriveChildKey = function(master, derivationPath, type, neuter) {
  if (type === 'xpub' || type === 'xprv') {
    const masterNode = prova.HDNode.fromBase58(master);
    const childKey = masterNode.derivePath(derivationPath);

    if (neuter) {
      return childKey.neutered().toBase58();
    }

    return childKey.toBase58();
  } else if (type === 'xlm') {
    const masterNode = stellarHd.fromSeed(master);
    const childKey = stellar.Keypair.fromRawEd25519Seed(masterNode.derive(derivationPath));

    if(neuter) {
      return childKey.publicKey();
    }

    return childKey.secret();
  }
};

// Ripple signing functions from BitGoJS
exports.computeSignature = function(tx, privateKey, signAs) {
  const signingData = signAs ?
    rippleParse.encodeForMultisigning(tx, signAs) : binary.encodeForSigning(tx);
  return rippleKeypairs.sign(signingData, privateKey);
};

exports.computeBinaryTransactionHash = require('ripple-hashes').computeBinaryTransactionHash;

exports.signXrpWithPrivateKey = function(txHex, privateKey, options) {
  let privateKeyBuffer = new Buffer(privateKey, 'hex');
  if (privateKeyBuffer.length === 33 && privateKeyBuffer[0] === 0) {
    privateKeyBuffer = privateKeyBuffer.slice(1, 33);
  }
  const privateKeyObject = prova.ECPair.fromPrivateKeyBuffer(privateKeyBuffer);
  const publicKey = privateKeyObject.getPublicKeyBuffer().toString('hex').toUpperCase();

  let tx;
  try {
    tx = rippleParse.decode(txHex);
  } catch (e) {
    try {
      tx = JSON.parse(txHex);
    } catch (e) {
      throw new Error('txHex needs to be either hex or JSON string for XRP');
    }
  }

  tx.SigningPubKey = (options && options.signAs) ? '' : publicKey;

  if (options && options.signAs) {
    const expectedSigner = rippleKeypairs.deriveAddress(publicKey);
    if (options.signAs !== expectedSigner) {
      throw new Error('signAs does not match private key');
    }
    const signer = {
      Account: options.signAs,
      SigningPubKey: publicKey,
      TxnSignature: exports.computeSignature(tx, privateKey, options.signAs)
    };
    tx.Signers = [{ Signer: signer }];
  } else {
    tx.TxnSignature = exports.computeSignature(tx, privateKey);
  }

  const serialized = rippleParse.encode(tx);
  return {
    signedTransaction: serialized,
    id: exports.computeBinaryTransactionHash(serialized)
  };
};


exports.UserInput = function(args) {
    _.assign(this, args);
};

// Prompt the user for input
exports.UserInput.prototype.prompt = function(question, required) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const deferred = Q.defer();
    rl.setPrompt(question);
    rl.prompt();
    rl.on('line', function(line) {
        line = line.trim();
        if (line || !required) {
            deferred.resolve(line);
            rl.close();
        } else {
            rl.prompt();
        }
    });
    return deferred.promise;
};

// Prompt the user for password input
exports.UserInput.prototype.promptPassword = function(question, allowBlank) {
    const self = this;
    const internalPromptPassword = function() {
        const deferred = Q.defer();
        read({ prompt: question, silent: true, replace: '*' }, function(err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(result);
            }
        });
        return deferred.promise;
    };

    // Ensure password not blank
    return internalPromptPassword()
        .then(function(password) {
            if (password || allowBlank) {
                return password;
            }
            return self.promptPassword(question);
        });
};

// Get input from user into variable, with question as prompt
exports.UserInput.prototype.getVariable = function(name, question, required, defaultValue) {
    const self = this;
    return function() {
        return Q().then(function() {
            if (self[name]) {
                return;
            }
            return Q().then(function() {
                if (name === 'password' || name === 'passcode') {
                    return self.promptPassword(question);
                } else {
                    return self.prompt(question, required);
                }
            })
                .then(function(value) {
                    if (!value && defaultValue) {
                        value = defaultValue;
                    }
                    self[name] = value;
                });
        });
    };
};

exports.UserInput.prototype.getPassword = function(name, question, confirm, allowBlank) {
    const self = this;
    let password;

    return function() {
        return Q().then(function() {
            if (self[name]) {
                return;
            }
            return self.promptPassword(question, allowBlank)
                .then(function(value) {
                    password = value;
                    if (confirm) {
                        return self.promptPassword('Confirm ' + question, true);
                    }
                })
                .then(function(confirmation) {
                    if (confirm && confirmation !== password) {
                        console.log("passwords don't match -- try again");
                        return self.getPassword(name, question, confirm)();
                    } else {
                        self[name] = password;
                    }
                });
        });
    };
};


exports.UserInput.prototype.getIntVariable = function(name, question, required, min, max) {
    const self = this;
    return function() {
        return self.getVariable(name, question, required)()
            .then(function() {
                const value = parseInt(self[name], 10);
                // eslint-disable-next-line
                if (value != self[name]) {
                    throw new Error('integer value required');
                }
                if (value < min) {
                    throw new Error('value must be at least ' + min);
                }
                if (value > max) {
                    throw new Error('value must be at most ' + max);
                }
                self[name] = value;
            })
            .catch(function(err) {
                console.log(err.message);
                delete self[name];
                if (required) {
                    return self.getIntVariable(name, question, required, min, max)();
                }
            });
    };
};



exports.addUserEntropy = function(userString) {
    // estimate 2 bits of entropy per character
    sjcl.random.addEntropy(userString, userString.length * 2, 'user');
};

/**
 * Generate a new BIP32 key based on a random seed, returning
 * the xpub, along with the encrypted split shares for the seed.
 *
 * @param   {Object} params  the UserInput object with params
 * @param   {Number} index   the index of the key in the batch
 * @returns {Object}         information about the key
 */
exports.genSplitKey = function(params, index) {
    const self = this;
    const key = exports.genKey();
    const result = {
        xpub: key.xpub,
        m: params.m,
        n: params.n
    };

    // If n==1, we're not splitting, just encrypt
    let shares;
    if (params.n === 1) {
        shares = [key.seed];
    } else {
        shares = secrets.share(key.seed, params.n, params.m);
    }

    const encryptedShares = shares.map(function(share, shareIndex) {
        const password = params['password' + shareIndex];
        const randomSalt = crypto.randomBytes(8);
        const encryptOptions = {
            iter: 10000,
            ks: 256,
            salt: [
                exports.bytesToWord(randomSalt.slice(0, 4)),
                exports.bytesToWord(randomSalt.slice(4))
            ]
        };
        return sjcl.encrypt(password, share, encryptOptions);
    });
    result.seedShares = encryptedShares;
    return result;
};

exports.genKey = function() {
    exports.addEntropy(128);
    const seedLength = 256 / 32; // 256 bits / 32-bit words
    const seed = sjcl.codec.hex.fromBits(sjcl.random.randomWords(seedLength));
    const extendedKey = bitcoin.HDNode.fromSeedHex(seed);
    const returnKey = {
        seed: seed,
        xpub: extendedKey.neutered().toBase58(),
        xprv: extendedKey.toBase58()
    };
    return returnKey;
};

/**
 * Add n bytes of entropy to the SJCL entropy pool from secure crypto
 * @param {Number} nBytes   number of bytes to add
 */
exports.addEntropy = function(nBytes) {
    const buf = crypto.randomBytes(nBytes).toString('hex');
    // Will throw if the system pool is out of entropy
    sjcl.random.addEntropy(buf, nBytes * 8, 'crypto.randomBytes');
};

// convert a 4 element Uint8Array to a 4 byte Number
exports.bytesToWord = (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 4) {
        throw new Error('bytes must be a Uint8Array with length 4');
    }

    return bytes.reduce((num, byte) => num * 0x100 + byte, 0);
};
