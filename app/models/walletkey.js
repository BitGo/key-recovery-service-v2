const mongoose = require('mongoose');
const _ = require('lodash');

const walletKeySchema = new mongoose.Schema({
  masterKey: { type: mongoose.Types.ObjectId },
  path: { type: mongoose.Types.String },
  xpub: { type: mongoose.Types.String },
  userEmail: { type: mongoose.Types.String },
  notificationUrl: { type: mongoose.Types.String },
  verificationInfo: { type: mongoose.Types.String },
  custom: {}
});

walletKeySchema.methods = {
  toJSON: function() {
    return _.pick(this, ['masterKey', 'path', 'xpub', 'userEmail', 'notificationUrl', 'verificationUrl', 'custom']);
  }
};

walletKeySchema.index({ masterKey: 1, path: 1 }, { unique: true });
walletKeySchema.index({ xpub: 1 }, { unique: true });
walletKeySchema.index({ userEmail: 1 });

module.exports = mongoose.connection.model('walletKey', walletKeySchema);
