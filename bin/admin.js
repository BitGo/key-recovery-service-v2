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

function saveKeys(xpubs) {
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

  console.log(`Found ${keys.length} valid public keys. Pushing to database.`);

  MasterKey.insertMany(keys).then(function() {
    console.log('Successfully imported all public keys.');
  }).catch(function(e) {
    console.log('FAILED to import all public keys. This is usually caused by trying to import a public key that already exists in the database.');
    console.log(e);
  });
}

function handleImportKeys(args) {
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
    .on('end', function() {
      xpubs = _.flatten(xpubs); // the CSV parser creates a 2d array of elements if multiple lines are present
      saveKeys(xpubs);
    });
}

const args = parser.parseArgs();

switch (args.cmd) {
  case 'import':
    handleImportKeys(args);
}
