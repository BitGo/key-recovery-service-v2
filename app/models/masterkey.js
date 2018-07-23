const mongoose = require('mongoose');
const _ = require('lodash');

const masterKeySchema = new mongoose.Schema({
  coin: { type: mongoose.Types.String },
  customerId: { type: mongoose.Types.String },
  xpub: { type: mongoose.Types.String },
  keyCount: { type: mongoose.Types.Number }
});

masterKeySchema.methods = {
  toJSON: function() {
    return _.pick(this, ['coin', 'customerId', 'xpub', 'keyCount']);
  }
};

masterKeySchema.index({ customerId: 1, coin: 1 }, { unique: true });

module.exports = mongoose.connection.model('masterKey', masterKeySchema);
