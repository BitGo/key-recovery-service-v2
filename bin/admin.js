#! /usr/bin/env node

const Promise = require('bluebird');
const admin = require('../app/admin');

Promise.try(function() {
  return admin.run();
}).catch(function(e) {
  console.log(e.message)
});
