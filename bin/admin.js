#! /usr/bin/env node

const Promise = require('bluebird');
const admin = require('../app/admin');

Promise.try(admin.run).catch(function(e) {
  console.log('Error connecting to database, proceeding offline...');
  try {
    admin.db.connection.close();
  } catch(e) {

  }
});
