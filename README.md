Key Recovery Service
====================
The key recovery service dispenses cryptocurrency public keys to requesters for use as backup keys in multisig wallets.

This project supports the following key schemes:
 - [BIP32 Extended Public Keys](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) -- compatible with Bitcoin, Ethereum, Litecoin, and most major cryptocurrencies
 - Stellar Keypairs -- compatible with Stellar Lumens

This service implements:

1. The key provisioning protocol (endpoint to get keys), provisioning master keys for new customers and deriving wallet-specific subkeys for returning customers.
2. An email to be sent to users when a key is provisioned, setting up their relationship with the KRS provider. 
3. An optional custom callback for customers expecting to create a large number of wallets, who may not want their inbox filled up with notifications.
4. A local admin tool for refilling the pool of available keys and managing customer-specific information.
5. An offline signing tool to sign recovery requests (in JSON format).

Tests for the service can be run with ``npm test``. 

Key Server Setup and Deployment
====================
The key server is BitGo's interface to the KRS service. It is responsible for storing, maintaining, and distributing public keys.

**Under no circumstance should private keys be stored on the key server.**

1. The KRS server is developed in NodeJS 6. Install NodeJS and NPM

    [NodeJS Installation Guide](http://howtonode.org/how-to-install-nodejs)
2. The KRS server stores public keys in a MongoDB 3 database. Install MongoDB on the same server as the KRS server, or on a separate server on the local network.

    [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/) 
3. Clone this repository
4. Run `npm install` in the KRS repository folder to install required libraries for the KRS server.
5. Configure the KRS service (see Configuration below)
6. Start the server with `npm start`
7. The service will be available via `http://localhost:6833/key`
8. Obtain a key by issuing a curl command like:

`curl -h "Content-Type: application/json" -d "{ "customerId": "123abc", "coin": "btc", "userEmail": "user@example.com", "custom": { } }" http://localhost:6833/key`

Replace `user@example.com` with your email in the above example to receive an email with your backup key.

Offline Environment Setup
====================
An offline environment is required for generating master keys, deriving hardened customer keys, and signing recovery transactions.

1. Install [BitGo CLI](https://github.com/BitGo/bitgo-cli) and the KRSv2 admin tool (``bin/admin.js``) on the offline environment
2. Generate a random BIP32 key pair with ``bitgo newkey``.
3. Shard the key with [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing) with the ``bitgo splitkeys`` command.
4. The key shards of the master private key **must** be stored securely. At a minimum, BitGo requires KRS operators to store keys with an industry-approved encryption standard such as AES-256. The encryption password **must** contain at least 16 characters, including uppercase and lowercase letters, numbers, and symbols.
5. Derive a large number of customer-specific public keys. These hardened BIP32 child keys will be allocated to new customers enrolling with the KRS server, or for returning customers enrolling for new coins. These keys will be saved to the ``keys.json`` file. It is recommended to generate a large number of keys so that the master private key does not need to be exposed often.

    ``bin/admin.js generate <xprv> xpubs.json --start 0 -n 1000000``
    
6. Generate a random Stellar HD seed with ``bin/admin.js seed``
7. Derive a large number of customer-specific public keys. These hardened Stellar keys will be allocated to wallets enrolling with the KRS server.

    ``bin/admin.js generate <seed> xlm_keys.json --start 0 -n 1000000 --type xlm``
    
8. Transfer the xpubs.json and xlm_keys.json files to the online key server via flash drive, SD card, or other physical medium.
9. Import the public keys to the key server's database with

    ``bin/admin.js import xpubs.json``
    
    ``bin/admin.js import xlm_keys.json --type xlm``

Configuration
====================
The KRS server must be configured with your service's branding, administrator email address, and Mailgun credentials before use.

1. [Sign up for a Mailgun account](https://www.mailgun.com/) and retrieve your username and password.
2. Store these credentials in the ``MAILGUN_USER`` and ``MAILGUN_PASS`` environment variables. Add the following to your ``~/.bash_profile``:
    ``export MAILGUN_USER=[mailgun username]``
    ``export MAILGUN_PASS=[mailgun password]``
3. In ``config.js``, provide your service's name, URL, public-facing email address, and administrator email address.
4. In ``config.js``, specify the address and port of your MongoDB database. If you installed MongoDB on the same server as the KRS server, you may use the default value for ``mongouri`` (``mongodb://localhost:27017/key-recovery-service``).

Offline Signing Tool
====================
The offline signing tool can be accessed with:
``bin/admin.js sign``

```
usage: admin.js sign [-h] [--key KEY] [--confirm] file

Positional arguments:
  file        path to the recovery request JSON file

Optional arguments:
  -h, --help  Show this help message and exit.
  --key KEY   private key to sign the transaction with (optional - will be prompted for if not specified here)
  --confirm   will not ask for confirmation before signing (be careful!)
```

In a recovery scenario, the user or BitGo will provide you with a recovery file containing:
 - The coin to be recovered
 - The backup key associated with the wallet
 - A raw transaction hex with one signature applied
 
It is your responsibility to verify the identity of the user (verification information can be stored and retrieved with ``bin/admin.js verification``), then co-sign the recovery in an offline environment. After cosigning a recovery, you can transfer the signed transaction hex to an online machine, and broadcast the transaction from any node or public block explorer.

Legal
====================
Copyright 2018 BitGo, Inc.
Licensed under the Apache License, Version 2.0 (the "License"); 
you may not use files in this project except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

You may obtain a copy of the License in the LICENSE file.
