process.config = require('../config');
process.config.mongouri = 'mongodb://localhost:27017/key-recovery-service-test';
process.config.mail = undefined;

const mongoose = require('../app/db');

mongoose.connection.on('error', function(err) {
  throw new Error(err);
});
mongoose.connection.once('open', function() {
  console.log('mongoose init successful');
});

exports.mongoose = mongoose;
