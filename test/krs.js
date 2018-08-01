const testutils = require('./testutils');
const should = require('should');
const Q = require('q');

const KRS = require('../app/krs');

describe('KRS Controller', function() {
  // describe('provisionKey', function() {
  //   it('should return an error if the userEmail was missing', function() {
  //     return Q()
  //     .then(function() {
  //       return KRS.provisionKey({body: {}})
  //     })
  //     .then(function() {
  //       throw new Error("should not succeed");
  //     })
  //     .catch(function(error) {
  //       error.status.should.eql(400);
  //       error.result.should.eql('userEmail required');
  //     });
  //   });
  //
  //   it('requester client id and secret not specified', function() {
  //     process.config.requesterAuth.required = true;
  //     return Q()
  //     .then(function() {
  //       return KRS.provisionKey({body: {userEmail: 'test@example.com'}});
  //     })
  //     .then(function(result) {
  //       throw new Error("should not succeed!");
  //     })
  //     .catch(function(error) {
  //       error.result.should.include("this krs requires you to send a requesterId and requesterSecret");
  //       process.config.requesterAuth.required = false;
  //     });
  //   });
  //   it('requester client id specified wrongly (blank)', function() {
  //     process.config.requesterAuth.required = true;
  //     return Q()
  //       .then(function() {
  //         return KRS.provisionKey({body: {userEmail: 'test@example.com', requesterId: ' ', requesterSecret: process.config.requesterAuth.clients.bitgo}});
  //       })
  //       .then(function(result) {
  //         throw new Error("should not succeed!");
  //       })
  //       .catch(function(error) {
  //         error.result.should.include("invalid requesterSecret");
  //         process.config.requesterAuth.required = false;
  //       });
  //   });
  //   it('requester client id specified but secret incorrect', function() {
  //     process.config.requesterAuth.required = true;
  //     return Q()
  //     .then(function() {
  //       return KRS.provisionKey({body: {userEmail: 'test@example.com', requesterId: 'bitgo', requesterSecret: 'badhacker'}});
  //     })
  //     .then(function(result) {
  //       throw new Error("should not succeed!");
  //     })
  //     .catch(function(error) {
  //       error.result.should.include("invalid requesterSecret");
  //       process.config.requesterAuth.required = false;
  //     });
  //   });
  //   it('should return a new key with correct requester id and secret', function() {
  //     process.config.requesterAuth.required = true;
  //     return Q()
  //     .then(function() {
  //       return KRS.provisionKey({body: {userEmail: 'test@example.com', requesterId: 'bitgo', requesterSecret: process.config.requesterAuth.clients.bitgo}});
  //     })
  //     .then(function(result) {
  //       result.xpub.substr(0, 4).should.equal('xpub');
  //       result.userEmail.should.equal('test@example.com');
  //       return Key.findOneQ({xpub: result.xpub})
  //       .then(function(key) {
  //         key.xpub.should.eql(result.xpub);
  //         key.path.should.eql(result.path);
  //         key.requesterId.should.eql('bitgo');
  //       });
  //     });
  //   });
  //
  //   it('should provision key correctly if disableKRSEmail was passed in', function() {
  //     process.config.requesterAuth.required = false;
  //     return Q()
  //     .then(function() {
  //       return KRS.provisionKey({body: { userEmail: 'satoshi@bitgo.com', disableKRSEmail: true }})
  //     })
  //     .then(function(key) {
  //       should.exist(key);
  //       key.userEmail.should.equal('satoshi@bitgo.com');
  //     });
  //   });
  //
  //   after(function() {
  //     process.config.requesterAuth.required = false;
  //   });
  // });
  //
  // describe('validateKey', function() {
  //   it('should return an error email and xpub not found', function() {
  //     return Q()
  //     .then(function() {
  //       return KRS.validateKey({params: {userEmail: 'invalid@other.com', xpub: 'abcdef'}})
  //     })
  //     .then(function() {
  //       throw new Error("should not succeed");
  //     })
  //     .catch(function(error) {
  //       error.status.should.eql(400);
  //       error.result.should.eql('userEmail and xpub required');
  //     });
  //   });
  // });
  //
  // describe('deriveFromPath', function() {
  //   it('should derive the 0th xpub correctly', function() {
  //     KRS.deriveFromPath('m/0').should.equal('xpub68zFDNY18ZjuK1MS4cqRB2akBYcRVePsA3mWqM9cvnGronp4ALE4A22uccbAxb7cA5vqsoJ9z81oS3erczJLst67rzSUb9DePfP3jdG1E2t');
  //   });
  //
  //   it('should derive the up to 4 levels correctly', function() {
  //     KRS.deriveFromPath('m/50/50/50/50').should.equal('xpub6EoBtLPkTEZ2oqetZaBiSxseRxA8bbYkHxC1tL96bYexCjNTwK32PnowGhwyXcWKxoYBftP2xL9uh8e65yb6CaBGwvpikbtp5riYSr7XbeA');
  //   });
  //
  //   it('should not derive invalid paths', function() {
  //     (function() {
  //       KRS.deriveFromPath("word");
  //     }).should.throw('invalid path');
  //     (function() {
  //       KRS.deriveFromPath("m/word'");
  //     }).should.throw('invalid path');
  //     (function() {
  //       KRS.deriveFromPath("m/word'");
  //     }).should.throw('invalid path');
  //     (function() {
  //       KRS.deriveFromPath("m/" + (Math.pow(2, 32) + 1));
  //     }).should.throw('Expected UInt32, got Number 4294967297');
  //     (function() {
  //       KRS.deriveFromPath("m/" + (Math.pow(2, 31) + 1));
  //     }).should.throw('Could not derive hardened child key');
  //   });
  // });
  //
  // describe('randomPath', function() {
  //   it('should derive a random path', function() {
  //     KRS.randomPath().substr(0, 2).should.equal('m/');
  //   });
  // });
});
