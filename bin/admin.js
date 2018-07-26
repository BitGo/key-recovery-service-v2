#! /usr/bin/env node

const admin = require('../app/admin');

Promise.try(function() {
  return admin.run();
}).catch(function(e) {
  console.log(e.message)
});
