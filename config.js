module.exports = {
  "name": "Friendly Key Recovery Service",
  "serviceurl": "yourdomain.com",
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
  "mongouri":  process.env.KRSV2_DBURL,
  "provider": {
    "id": "bitgo",
    "secret": "youshouldchangethis"
  },
  "mail": {
    "fromemail": "Friendly Key Recovery Service <no-reply@yourdomain.com>",
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
  "disableAllKRSEmail": true,
  "lowKeyWarningLevels": [10000, 5000, 1000, 500, 100, 0]
};
