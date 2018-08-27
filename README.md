Key Recovery Service
====================
The key recovery service dispenses extended public keys (xpubs) to requesters for use as backup keys in multisig wallets. Dispensed keys are compatible with all coins which implement the [BIP32 key derivation scheme](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki).

This service implements:

1. The key provisioning protocol (endpoint to get keys), provisioning master keys for new customers and deriving wallet-specific subkeys for returning customers.
2. An email to be sent to users when a key is provisioned, setting up their relationship with the KRS provider. 
3. An optional custom callback for customers expecting to create a large number of wallets, who may not want their inbox filled up with notifications.
4. A local admin tool for refilling the pool of available keys and managing customer-specific information.
5. An offline signing tool to sign recovery requests (in JSON format).

Tests for the service can be run with ``npm test``. 

Getting Started
====================
1. Git clone this repository.
2. Do an ``npm install`` in the root folder.
3. Run ``node bin/server.js`` to start the service.
4. Import public keys with ``node bin/admin.js import <path to CSV file containing xpubs>``
5. The service should be accessible in the browser via ``http://localhost:6833/key`` 
6. Start obtaining a key by issuing a curl command like:

``curl -H "Content-Type: application/json" -d '{ "customerId": "acme-inc-123", "coin": "btc", "userEmail": "user@example.com", "custom": { "phone": "1-800-123-4567" } }' http://localhost:6833/key``

Offline Signing Tool
====================
The offline signing tool can be accessed with:
``node bin/admin.js sign``

```
usage: bin/admin.js sign [-h] [FILE] [KEY] [--confirm]

Tool to sign recovery JSON offline (for KRS owners recovery)

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  FILE                  Input file of recovery request JSON
  KEY                   xprv (private key) for signing
```

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
