const mongoose = require('mongoose');

// if running in an environment with mongolab, go ahead and use it
if (process.env.MONGOLAB_URI) {
  process.config.mongouri = process.env.MONGOLAB_URI;
}

// connect only if no existing connection is made
if (mongoose.connection.readyState === 0) {
  console.log('connecting: ' + process.config.mongouri);
  mongoose.connect(process.config.mongouri, { useNewUrlParser: true });
}

module.exports = mongoose;
