const argumentParser = require('argparse').ArgumentParser;
const fs = require('fs');
const http = require('http');
const https = require('https');
const pjson = require('../package.json');

process.config = require('../config');
const db = require('../app/db');

// Handle arguments
const getArgs = function () {
  const parser = new argumentParser({
    version: pjson.version,
    addHelp: true,
    description: 'Key Recovery Service'
  });

  parser.addArgument(
    ['-p', '--port'], {
      help: 'Port to listen on'
    });

  parser.addArgument(
    ['-b', '--bind'], {
      help: 'Bind to given address to listen for connections (default: localhost)'
    });

  parser.addArgument(
    ['-d', '--debug'], {
      action: 'storeTrue',
      help: 'Debug logging'
    });

  parser.addArgument(
    ['-k', '--keypath'], {
      help: 'Path to the SSL Key file (required if running production)'
    });

  parser.addArgument(
    ['-c', '--crtpath'], {
      help: 'Path to the SSL Crt file (required if running production)'
    });

  parser.addArgument(
    ['-l', '--logfile'], {
      help: 'Filepath to write the access log'
    });

  return parser.parseArgs();
};

const args = getArgs();
const app = require('../app/app')(args);

let baseUri = 'http';
let server;
if (args.keypath && args.crtpath) {
  // Run in SSL mode
  const privateKey = fs.readFileSync(args.keypath, 'utf8');
  const certificate = fs.readFileSync(args.crtpath, 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  baseUri += 's';
  server = https.createServer(credentials, app);
} else {
  server = http.createServer(app);
}

const host = args.bind || process.config.host || 'localhost';
const port = args.port || process.env.PORT || process.config.port || 80;

db.connection.on('error', console.error.bind(console, 'database connection error: '));
db.connection.once('open', function () {
  server.listen(port, host);

  baseUri += '://' + host;
  if (!((port === 80 && !args.keypath) || (port === 443 && args.keypath))) {
    baseUri += ':' + port;
  }
  console.log('Listening on: ' + baseUri);
});
