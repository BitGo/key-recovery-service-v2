const should = require('should');

const admin = require('../app/admin.js');

describe('Offline Admin Tool', function() {
  describe('Xpub validation', function() {
    // Xpub importing was tested with a local file with contents: (w/o line breaks)
    // xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU,
    // xpub69pXXVvsBtZHWE1wgoix7xRAnbp1r6tR1kTK9cKvCd4QgYh4JBSLBmLA65Kg7rCMwGYrNHKFKxZDtjRkU4Ex2ozMYGfk14EyotJ5xjf2Goy,
    // xpub6AU2iYgKUY8FvUc2Nz2fcWpKU1HJTeYTbzv4MZLGPBw2YnhoZPkkUo54fvqZyVtxtszMdyksF8k3iqMcoegyvj72xKZCmuCjDWneXjjztLN
    // and successfully saved to local Mongo instance
    describe('failure', function() {
      it('should fail if length is not 111', function() {
        const SHORT_XPUB = 'xpub1234567890';

        admin.validateXpub(SHORT_XPUB).should.equal(false);
      });

      it('should fail if does not start with xpub', function() {
        const BAD_PREFIX_XPUB = 'xprv9wHokC2KXdTSpEepFcu53hMDUHYfAtTaLEJEMyxBPAMf78hJg17WhL5FyeDUQH5KWmGjGgEb2j74gsZqgupWpPbZgP6uFmP8MYEy5BNbyET';

        admin.validateXpub(BAD_PREFIX_XPUB).should.equal(false);
      });

      it('should fail if not base58 valid', function() {
        const BAD_CHARS_XPUB = 'xpub0OIl0OIl6t7aLemM4KiBoLBYQ5j9G2SVpNTojw7Vki3j7wcM3NRPVmDjnjwQREzPcywEg793M89odNXWneRQkn1eWjptpukDwJQVgVLRHKV'

        admin.validateXpub(BAD_CHARS_XPUB).should.equal(false);
      });
    });

    describe('success', function() {
      it('should succeed with a valid xpub', function() {
        const GOOD_XPUB = 'xpub6B7XuUcPQ9MeszNzaTTGtni9W79MmFnHa7FUe7Hrbv3pefnaDFCHtJWaWdg1FVbocHhivnCRTCbHTjDrMBEyAGDJHGyqCnLhtEWP2rtb1sL';

        admin.validateXpub(GOOD_XPUB).should.equal(true);
      });
    });
  });
});
