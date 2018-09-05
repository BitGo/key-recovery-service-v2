const should = require('should');

const testutils = require('./testutils');
const admin = require('../app/admin.js');
const MasterKey = require('../app/models/masterkey');
const WalletKey = require('../app/models/walletkey');
const utils = require('../app/utils.js');

describe('Offline Admin Tool', function() {
  before(function() {
    testutils.mongoose.connection.dropDatabase();
  });

  describe('Xpub validation', function() {
    // Xpub importing was tested with a local file with contents: (w/o line breaks)
    // xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU,
    // xpub69pXXVvsBtZHWE1wgoix7xRAnbp1r6tR1kTK9cKvCd4QgYh4JBSLBmLA65Kg7rCMwGYrNHKFKxZDtjRkU4Ex2ozMYGfk14EyotJ5xjf2Goy,
    // xpub6AU2iYgKUY8FvUc2Nz2fcWpKU1HJTeYTbzv4MZLGPBw2YnhoZPkkUo54fvqZyVtxtszMdyksF8k3iqMcoegyvj72xKZCmuCjDWneXjjztLN
    // and successfully saved to local Mongo instance
    describe('failure', function() {
      it('should fail if length is not 111', function() {
        const SHORT_XPUB = { path: 'm/0\'', xpub: 'xpub1234567890'};

        admin.validateXpub(SHORT_XPUB).should.equal(false);
      });

      it('should fail if does not start with xpub', function() {
        const BAD_PREFIX_XPUB = { path: 'm/0\'', xpub: 'xprv9wHokC2KXdTSpEepFcu53hMDUHYfAtTaLEJEMyxBPAMf78hJg17WhL5FyeDUQH5KWmGjGgEb2j74gsZqgupWpPbZgP6uFmP8MYEy5BNbyET'};

        admin.validateXpub(BAD_PREFIX_XPUB).should.equal(false);
      });

      it('should fail if not base58 valid', function() {
        const BAD_CHARS_XPUB = { path: 'm/0\'', xpub: 'xpub0OIl0OIl6t7aLemM4KiBoLBYQ5j9G2SVpNTojw7Vki3j7wcM3NRPVmDjnjwQREzPcywEg793M89odNXWneRQkn1eWjptpukDwJQVgVLRHKV' };

        admin.validateXpub(BAD_CHARS_XPUB).should.equal(false);
      });
    });

    describe('success', function() {
      it('should succeed with a valid key', function() {
        const GOOD_XPUB = { path: 'm/0\'', xpub: 'xpub6B7XuUcPQ9MeszNzaTTGtni9W79MmFnHa7FUe7Hrbv3pefnaDFCHtJWaWdg1FVbocHhivnCRTCbHTjDrMBEyAGDJHGyqCnLhtEWP2rtb1sL' };

        admin.validateXpub(GOOD_XPUB).should.equal(true);
      });
    });
  });

  describe('BIP32 child key derivation', function() {
    // from https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki test vector 2 chain m
    const MASTER_XPUB = 'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB';

    describe('failure', function() {
      it('should fail with an invalid xpub', function() {
        const BAD_XPUB = 'xpub55555';

        (function() { admin.deriveKey(BAD_XPUB, 'm/0') }).should.throw(Error);
      });

      it('should fail with an invalid derivation path', function() {
        (function() { admin.deriveKey(MASTER_XPUB, 'derivation path' )}).should.throw(Error);
      });

      it('should fail if trying to derive hardened index with xpub', function() {
        (function() { admin.deriveKey(MASTER_XPUB, 'm/0\'' )}).should.throw(Error);
      })
    });

    describe('success', function() {
      // test vector 2 from https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
      it('should find m/0 of test vector 2', function() {
        const M_0 = 'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH';

        utils.deriveChildKey(MASTER_XPUB, 'm/0').should.equal(M_0);
      })
    })
  })

  describe('Verification', function() {
    before(function() {
      const key = new WalletKey({
        xpub: 'xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU',
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
