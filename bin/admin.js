#! /usr/bin/env node

const Promise = require('bluebird');
const admin = require('../app/admin');

Promise.try(admin.run).catch(function(e) {
  console.log(e.message);
  console.log(e.stack);
  if (admin.db && admin.db.connection) {
    admin.db.connection.close();
  }
});
