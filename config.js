module.exports = {
  "name": "BitGo Key Recovery Service",
  "serviceurl": "www.bitgo.com/",
  "supportedcoins": {
    btc: 'xpub',
    tbtc: 'xpub',
    eth: 'xpub',
    teth: 'xpub',
    ltc: 'xpub',
    tltc: 'xpub',
    bch: 'xpub',
    tbch: 'xpub',
    zec: 'xpub',
    tzec: 'xpub',
    xrp: 'xpub',
    txrp: 'xpub',
    xlm: 'xlm',
    txlm: 'xlm'
  },
  "host": "0.0.0.0",
  "port": 6833,
  "adminemail": "danny@bitgo.com",
  "mongouri": "test-user:test-pass@mongodb://127.0.0.1:27017/test-db",
  //"mongouri": process.env.KRSV2_DBURL,
  "provider": {
    "id": "bitgo",
    "secret": "youshouldchangethis"
  },
  "mail": {
    "fromemail": "BitGo Key Recovery Service <no-reply@bitgo.com>",
    "host": "smtp.mailgun.org",
    "port": 587,
    "auth": {
      "user": process.env.MAILGUN_USER,
      "pass": process.env.MAILGUN_PASS
    }
  },
  "requesterAuth": {
    "required": false,
    "clients": {
      "bitgo": "changeThisSecret"
    }
  },
  "lowKeyWarningLevels": [10000, 5000, 1000, 500, 100, 0],
  "disableAllEmails": true
};
