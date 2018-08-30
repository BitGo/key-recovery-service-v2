var mongoose = require('mongoose');
var _ = require('lodash');

var recoverySchema = new mongoose.Schema({
  masterxpub: {type: String},
  xpub: {type: String},
  userEmail: {type: String},
  transactionHex: {type: String},
  inputs: {},
  created: { type: Date, default: Date.now },
  custom: {}
});

recoverySchema.methods = {
  toJSON: function() {
    var result = _.pick(this, ['xpub', 'userEmail', 'transactionHex', 'inputs', 'custom']);
    result.id = this._id;
    return result;
  }
};

module.exports = mongoose.connection.model('recoveryrequest', recoverySchema);
