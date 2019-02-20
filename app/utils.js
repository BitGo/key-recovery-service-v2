const Q = require('q');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const jsrender = require('jsrender');
const prova = require('prova-lib');
const utxoLib = require('bitgo-utxo-lib');
const stellar = require('stellar-base');
const stellarHd = require('stellar-hd-wallet');
const bitgojs = require('bitgo');
const bitgo = new bitgojs.BitGo({});
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
    const masterNode = utxoLib.HDNode.fromBase58(master);
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

exports.halfSignEthTransaction = function(coin, txPrebuild, key) {
  const basecoin = bitgo.coin(coin);
  const obj = {
    prv: key,
    gasLimit: txPrebuild.gasLimit,
    gasPrice: txPrebuild.gasPrice,
    expireTime: txPrebuild.expireTime,
    txPrebuild
  };
  const signedtx = basecoin.signTransaction(obj);
  const outFile = {
    txInfo: signedtx.halfSigned
  }
  outFile.txInfo.recipient = outFile.txInfo.recipients[0];
  delete outFile.txInfo.recipients;
  outFile.txInfo.clientSignature = outFile.txInfo.signature;
  delete outFile.txInfo.signature;
  return outFile;
}
