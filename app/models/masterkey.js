const mongoose = require('mongoose');
const _ = require('lodash');

const masterKeySchema = new mongoose.Schema({
  type: { type: String, default: 'xpub', enum: ['xpub', 'xlm'] },
  coin: { type: String },
  customerId: { type: String },
  pub: { type: String },
  xlmpub: {type: String},
  path: { type: String },
  keyid: {type: Number},
  keyCount: { type: Number }
});

masterKeySchema.methods = {
  toJSON: function() {
    return _.pick(this, ['type', 'coin', 'customerId', 'pub', 'path', 'keyCount']);
  }
};

masterKeySchema.index({ customerId: 1, coin: 1 }, { sparse: true });
masterKeySchema.index({ pub: 1 }, { unique: true });
masterKeySchema.index({ path: 1, type: 1 }, { unique: true });
masterKeySchema.index({ type: 1 });

module.exports = mongoose.connection.model('masterKey', masterKeySchema);
