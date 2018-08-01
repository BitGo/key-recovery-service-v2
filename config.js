module.exports = {
  "name": "Friendly Key Backup Service",
  "serviceurl": "http://keyrecoveryservice.yourdomain.com/",
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
  }
}
