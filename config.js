module.exports = {
  "name": "Friendly Key Backup Service",
  "serviceurl": "http://keyrecoveryservice.yourdomain.com/",
  "supportedcoins": ["btc", "eth", "ltc", "bch", "zec", "xrp"],
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
  "lowKeyWarningLevels": [10000, 5000, 1000, 500, 100, 0]
}
