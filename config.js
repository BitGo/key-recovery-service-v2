module.exports = {
  "name": "Friendly Key Recovery Service",
  "serviceurl": "yourdomain.com",
  "supportedcoins": {
    btc: 'xpub',
    tbtc: 'xpub',
    eth: 'xpub',
    teth: 'xpub',
    eos: 'xpub',
    teos: 'xpub',
    erc: 'xpub',
    terc: 'xpub',
    ltc: 'xpub',
    tltc: 'xpub',
    bch: 'xpub',
    tbch: 'xpub',
    bsv: 'xpub',
    tbsv: 'xpub',
    zec: 'xpub',
    tzec: 'xpub',
    xrp: 'xpub',
    txrp: 'xpub',
    dash: 'xpub',
    tdash: 'xpub',
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
    },
    "tags": ["This is not the tag you're looking for" , "Outa gouta, Solo?" , "It’s a trap!"]
  },
  "mailchimp" : {
    "apiEndpoint": "https://us4.api.mailchimp.com/3.0/",
    "apiKey" : "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-us4",
    "listId" : "de165667ab",
    "moreWalletsTags" : ["Lead-BitGo Wallet", "Wallet-Multi"],
    "firstWalletTags" : ["Lead-BitGo Wallet", "Wallet-Single"]
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
  "sendMailChimpNotKRSEMail": true,
  "lowKeyWarningLevels": [10000, 5000, 1000, 500, 100, 0]
};
