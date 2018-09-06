const mongoose = require('mongoose');
const _ = require('lodash');

const masterKeySchema = new mongoose.Schema({
  coin: { type: String },
  customerId: { type: String },
  xpub: { type: String },
  path: { type: String },
  keyCount: { type: Number }
});

masterKeySchema.methods = {
  toJSON: function() {
    return _.pick(this, ['coin', 'customerId', 'xpub', 'path', 'keyCount']);
  }
};

masterKeySchema.index({ customerId: 1, coin: 1 }, { unique: true, sparse: true });
masterKeySchema.index({ xpub: 1 }, { unique: true });
masterKeySchema.index({ path: 1 }, { unique: true });

module.exports = mongoose.connection.model('masterKey', masterKeySchema);
