const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const utils = require('./utils');
const krs = require('./krs');

module.exports = function(args) {
  args = args || {};
  const app = express();

  // Set up morgan for logging, with optional logging into a file
  if (args.logfile) {
    // create a write stream (in append mode)
    const accessLogPath = path.resolve(args.logfile);
    const accessLogStream = fs.createWriteStream(accessLogPath, { flags: 'a' });
    console.log('Log location: ' + accessLogPath);
    // setup the logger
    app.use(morgan('combined', { stream: accessLogStream }));
  } else {
    app.use(morgan('combined'));
  }

  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }));
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(clientErrorHandler);
  app.use(errorHandler);

  app.get('/', function (req, res, next) {
    res.send({ name: process.config.name });
    next();
  });

  app.post('/key', utils.promiseWrapper(krs.provisionKey));

  app.post('/isUserKey', utils.promiseWrapper(krs.isUserKey));

  app.post('/isUser', utils.promiseWrapper(krs.isUser));
  return app;
};

function clientErrorHandler (err, req, res, next) {
  if (req.xhr) {
    res.status(500).send({ error: 'Something failed!' })
  } else {
    next(err)
  }
};

function errorHandler (err, req, res, next) {
  res.status(500)
  res.json({ error: "Oops! Internal server error." })
};
