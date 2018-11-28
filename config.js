module.exports = {
  "name": "Friendly Key Backup Service",
  "serviceurl": "http://keyrecoveryservice.yourdomain.com/",
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
  "adminemail": "davidcruz@bitgo.com",
  "mongouri": "mongodb://localhost:27017/key-recovery-service",
  "provider": {
    "id": "bitgo",
    "secret": "youshouldchangethis"
  },
  "mail": {
    "fromemail": "KRS.XYZ <krs@example.com>",
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
  "verificationPub": null,
  "neverReuseMasterKey": true,
  "lowKeyWarningLevels": [10000, 5000, 1000, 500, 100, 0]
};
