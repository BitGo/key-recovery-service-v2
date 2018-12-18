#! /usr/bin/env node

const Promise = require('bluebird');
const admin = require('../app/admin');

Promise.try(admin.run).catch(function(e) {
  console.log('Did not connect to database, proceeding offline...');
  try {
    admin.db.connection.close();
  } catch(e) {

  }
});
