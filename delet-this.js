const utils = require('./app/utils.js');
process.config = require('./config.js');

utils.sendMailQ(
  'davidcruz@bitgo.com',
  "Information about your backup key",
  'newkeytemplate',
  {
    xpub: 'xpub12345',
    servicename: process.config.name,
    serviceurl: process.config.serviceurl,
    adminemail: process.config.adminemail,
    useremail: 'davidcruz@bitgo.com'
  }
);
