const should = require('should');

const testutils = require('./testutils');
const admin = require('../app/admin.js');
const WalletKey = require('../app/models/walletkey');
const MasterKey = require('../app/models/masterkey');
const utils = require('../app/utils.js');
const Promise = require('bluebird');
const co = Promise.coroutine;
let originalVerifcationPub = process.config.verificationPub;

const testVerificationPub = '1GS6JPCUpyFZLrE5bbJBcpeg1EdqW63nHd';
const xpub = 'xpub661MyMwAqRbcGGPNi42htgwXoLuPjEtdRSRUm65GWRPAb31WPRRkxzL18TGrpU2sirNjXAHFjAEmiav9kmVfY83dTfxh3DVVwNcM9JNVebh';
const xpubSig = 'IJB1Ubed4LNVvHfbH3s7i9duWmVi+98rCcGpB/t/V9xkY+VLl+YEv3w/g/79QgHYFv4D/nm2SGrT+FaOL1PomTU';
const xlmPub = 'GCM67ICQVOYN7GYYHMMGVPQ7NDCLNVBM4R74IIQTG65H4DM3KGEDMW3S';
const xlmSig = 'IBdvAO2063rsqo6zyhcoq4qGWMZFFQXCbcP4X7/vnbuyQO7VF2FHHr/M85CQb/yBfPgZRy5VsmDmrW3Qa6OXk6w';
const badSig = 'IBadAO2063rsqo6zyhcoq4qGWMZFFQXCbcP4X7/vnbuyQO7VF2FHHr/M85CQb/yBfPgZRy5VsmDmrW3Qa6OXk6w';

describe('Offline Admin Tool', function() {
  before(function() {
    testutils.mongoose.connection.dropDatabase();
  });

  after(function() {
    testutils.mongoose.connection.close();
    process.config.verificationPub = originalVerifcationPub;
  });

  describe('Xpub validation', function() {

    // Xpub importing was tested with a local file with contents: (w/o line breaks)
    // xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU,
    // xpub69pXXVvsBtZHWE1wgoix7xRAnbp1r6tR1kTK9cKvCd4QgYh4JBSLBmLA65Kg7rCMwGYrNHKFKxZDtjRkU4Ex2ozMYGfk14EyotJ5xjf2Goy,
    // xpub6AU2iYgKUY8FvUc2Nz2fcWpKU1HJTeYTbzv4MZLGPBw2YnhoZPkkUo54fvqZyVtxtszMdyksF8k3iqMcoegyvj72xKZCmuCjDWneXjjztLN
    // and successfully saved to local Mongo instance
    describe('failure', function() {
      process.config.verificationPub = null;
      it('should fail if length is not 111', function() {
        const SHORT_XPUB = { path: 'm/0\'', pub: 'xpub1234567890' };

        admin.validateKey(SHORT_XPUB, 'xpub').should.equal(false);
      });

      it('should fail if does not start with xpub', function() {
        const BAD_PREFIX_XPUB = { path: 'm/0\'', pub: 'xprv9wHokC2KXdTSpEepFcu53hMDUHYfAtTaLEJEMyxBPAMf78hJg17WhL5FyeDUQH5KWmGjGgEb2j74gsZqgupWpPbZgP6uFmP8MYEy5BNbyET'};

        admin.validateKey(BAD_PREFIX_XPUB, 'xpub').should.equal(false);
      });

      it('should fail if not base58 valid', function() {
        const BAD_CHARS_XPUB = { path: 'm/0\'', pub: 'xpub0OIl0OIl6t7aLemM4KiBoLBYQ5j9G2SVpNTojw7Vki3j7wcM3NRPVmDjnjwQREzPcywEg793M89odNXWneRQkn1eWjptpukDwJQVgVLRHKV' };

        admin.validateKey(BAD_CHARS_XPUB, 'xpub').should.equal(false);
      });
    });

    describe('success', function() {
      it('should succeed with a valid key', function() {
        process.config.verificationPub = null;
        const GOOD_XPUB = { path: 'm/0\'', pub: 'xpub6B7XuUcPQ9MeszNzaTTGtni9W79MmFnHa7FUe7Hrbv3pefnaDFCHtJWaWdg1FVbocHhivnCRTCbHTjDrMBEyAGDJHGyqCnLhtEWP2rtb1sL' };
        admin.validateKey(GOOD_XPUB, 'xpub').should.equal(true);
      });
    });
  });

  describe('BIP32 child key derivation', function() {
  process.config.verificationPub = null;
    // from https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki test vector 2 chain m
    const MASTER_XPUB = 'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB';

    describe('failure', function() {
      it('should fail with an invalid xpub', function() {
        const BAD_XPUB = 'xpub55555';

        (function() { utils.deriveChildKey(BAD_XPUB, 'm/0', 'xpub') }).should.throw(Error);
      });

      it('should fail with an invalid derivation path', function() {
        (function() { utils.deriveChildKey(MASTER_XPUB, 'derivation path', 'xpub') }).should.throw(Error);
      });

      it('should fail if trying to derive hardened index with xpub', function() {
        (function() { utils.deriveChildKey(MASTER_XPUB, 'm/0\'', 'xpub') }).should.throw(Error);
      })
    });

    describe('success', function() {
      // test vector 2 from https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
      it('should find m/0 of test vector 2', function() {
        const M_0 = 'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH';

        utils.deriveChildKey(MASTER_XPUB, 'm/0', 'xpub').should.equal(M_0);
      });
    })
  });

  describe('Stellar key derivation', function() {
      process.config.verificationPub = null;
      // from test 3 at https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md#test-cases
      const MASTER_SEED = '937ae91f6ab6f12461d9936dfc1375ea5312d097f3f1eb6fed6a82fbe38c85824da8704389831482db0433e5f6c6c9700ff1946aa75ad8cc2654d6e40f567866'

      describe('failure', function() {
          it('should fail with an invalid master seed', function() {
              const BAD_SEED = '-thisisabadseed';

              (function() { utils.deriveChildKey(BAD_SEED, "m/148'", 'xlm') }).should.throw(Error);
          });

          it('should fail with an invalid derivation path', function() {
              (function() { utils.deriveChildKey(MASTER_SEED, 'derivation path', 'xlm') }).should.throw(Error);
          });
      });

      describe('success', function() {
          // test 3 from https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md#test-cases
          it("should find m/44'/148'/0' of test vector 3", function() {
              const pub = 'GC3MMSXBWHL6CPOAVERSJITX7BH76YU252WGLUOM5CJX3E7UCYZBTPJQ';
              const priv = 'SAEWIVK3VLNEJ3WEJRZXQGDAS5NVG2BYSYDFRSH4GKVTS5RXNVED5AX7';

              const publicKey = utils.deriveChildKey(MASTER_SEED, "m/44'/148'/0'", 'xlm', true);
              publicKey.should.equal(pub);
              const secret = utils.deriveChildKey(MASTER_SEED, "m/44'/148'/0'", 'xlm', false);
              secret.should.equal(priv);
          });

          // test 3 from https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md#test-cases
          it("should find m/44'/148'/6' of test vector 3", function() {
              const pub = 'GCUDW6ZF5SCGCMS3QUTELZ6LSAH6IVVXNRPRLAUNJ2XYLCA7KH7ZCVQS';
              const priv = 'SBSHUZQNC45IAIRSAHMWJEJ35RY7YNW6SMOEBZHTMMG64NKV7Y52ZEO2';

              const publicKey = utils.deriveChildKey(MASTER_SEED, "m/44'/148'/6'", 'xlm', true);
              publicKey.should.equal(pub);
              const secret = utils.deriveChildKey(MASTER_SEED, "m/44'/148'/6'", 'xlm', false);
              secret.should.equal(priv);
          });
      })
  });

  describe('Key signature verification', function() {

        describe('failure', function() {
            it('should fail xpub validation with a bad signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xpub,
                    signature: badSig
                };
                const valid = admin.validateKey(key,'xpub');
                valid.should.equal(false);
            });

            it('should fail xlm validation with a bad signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xlmPub,
                    signature: badSig
                };
                const valid = admin.validateKey(key,'xlm');
                valid.should.equal(false);
            });

            it('should fail xpub validation with no signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xpub
                };
                const valid = admin.validateKey(key,'xpub');
                valid.should.equal(false);
            });

            it('should fail xlm validation with no signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xlmPub
                };
                const valid = admin.validateKey(key,'xlm');
                valid.should.equal(false);
            });
        });

        describe('success', function() {
            it('should validate xpub with a good signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xpub,
                    signature: xpubSig
                };
                const valid = admin.validateKey(key,'xpub');
                valid.should.equal(true);
            });

            it('should validate xlm with a good signature', function() {
                process.config.verificationPub = testVerificationPub;
                const key = {
                    pub: xlmPub,
                    signature: xlmSig
                };
                const valid = admin.validateKey(key,'xlm');
                valid.should.equal(true);
            });
        });
   });

  describe('Save a key with a signature', co(function *() {
      it('should successfully save a key with a signature to the database', co(function *() {
          process.config.verificationPub = testVerificationPub;
          const key = {
              pub: xpub,
              signature: xpubSig,
              path: '0'
          };
          const keyList = [key];
          yield admin.saveKeys(keyList, 'xpub');
          const foundKey = yield MasterKey.findOne({ pub: xpub });
          foundKey.should.have.property('signature');
      }));
  }));

  describe('Verification', function() {
    before(function() {
      const key = new WalletKey({
        pub: 'xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU',
        userEmail: 'tester@bitgo.com',
        verificationInfo: 'verify user\'s identity by signed letter delivered by carrier pigeon'
      });

      key.save();
    });

    it('should fail to retrieve verification info on a non-existent key', function() {
      admin.run(['verification', 'get', 'xpub6ARXqCvahM4dyWYDSPZMiii32yt3DTETyWCLDRZpQR4zpU9q6VmBKySA91hsLjofoUjdKdqPCcC54mbpJBmGNsNKM1szecH56p7Vk1byadR'])
        .should.eventually.throw();
    });

    it('should retrieve verification info on a key', function() {
      admin.run(['verification', 'get', 'xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU'])
        .should.eventually.not.throw();
    });
  });
});
