const Q = require('q');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const jsrender = require('jsrender');
const prova = require('prova-lib');

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

exports.formatBTCFromSatoshis = function(satoshis) {
  return (satoshis * 1e-8).toFixed(4);
};

exports.deriveChildKey = function(masterXpub, derivationPath) {
  const masterNode = prova.HDNode.fromBase58(masterXpub);

  return masterNode.derivePath(derivationPath).toBase58();
};
