#! /usr/bin/env node

process.config = require('../config');

const Promise = require('bluebird');
const co = Promise.coroutine;
const _ = require('lodash');
const ArgumentParser = require('argparse').ArgumentParser;
const pjson = require('../package.json');
const fs = require('fs');
const csvParser = require('csv-parse');

const db = require('../app/db.js');
const MasterKey = require('../app/models/MasterKey.js');

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

const saveKeys = co(function *(xpubs) {
  const keys = [];

  for (const xpub of xpubs) {
    if (!xpub.startsWith('xpub') || xpub.length !== 111) {
      console.log(`${xpub} is not a valid public key. Skipping`);
      continue;
    }

    keys.push({
      xpub: xpub,
      keyCount: 0
    });
  }

  if (keys.length === 0) {
    console.log('No valid public keys. Please make sure all public keys begin with "xpub" and are 111 characters in length.');
    return;
  }

  console.log(`Found ${keys.length} valid public keys. Pushing to database.`);

  try {
    yield MasterKey.insertMany(keys);
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

const run = co(function *() {
  const args = parser.parseArgs();

  switch (args.cmd) {
    case 'import':
      yield handleImportKeys(args);
  }
});

Promise.try(function () {
  return run();
}).catch( function(err) {
  console.log(err);
})

