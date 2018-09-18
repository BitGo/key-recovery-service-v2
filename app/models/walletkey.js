const mongoose = require('mongoose');
const _ = require('lodash');

const walletKeySchema = new mongoose.Schema({
  masterKey: { type: String },
  path: { type: String },
  pub: { type: String },
  userEmail: { type: String },
  notificationUrl: { type: String },
  verificationInfo: { type: String },
  custom: {}
});

walletKeySchema.methods = {
  toJSON: function() {
    return _.pick(this, ['masterKey', 'path', 'pub', 'userEmail', 'notificationUrl', 'verificationUrl', 'custom']);
  }
};

walletKeySchema.index({ pub: 1 }, { unique: true });
walletKeySchema.index({ userEmail: 1 });

module.exports = mongoose.connection.model('walletKey', walletKeySchema);
