const testutils = require('./testutils');
const request = require('supertest');
const should = require('should');
const server = require('../app/app')();
const _ = require('lodash');
const Promise = require('bluebird');
const co = Promise.coroutine;

const MasterKey = require('../app/models/masterkey');

describe('Application Server', function() {
  let agent;
  before(co(function *() {
    agent = request.agent(server);

    // Add one master key to the test database, to be provisioned later
    const masterKey = new MasterKey({ xpub: 'xpub68LYUvd1jGgRCLBHHjXtaaXRuYfRXsps9QFK3KoihrkieAX719fZLZoUApch11egYsjMyrL3WgrBRn2RxUS63sr7MTnQEYFKXoGr7nKwQfD', path: 'm/0\'', keyCount: 0 });
    yield masterKey.save();
  }));

  after(function() {
    testutils.mongoose.connection.dropDatabase();
    testutils.mongoose.connection.close();
  });

  describe('GET /', function() {
    it('should return the name', function() {
      return agent
      .get('/')
      .then(function(res) {
        res.status.should.eql(200);
        res.body.name.should.equal(process.config.name);
      });
    });
  });

  describe('Provision new key', function() {
    it('no userEmail specified', function () {
      return agent
        .post('/key')
        .send({
          customerId: 'enterprise-id',
          coin: 'btc',
        })
        .then(function (res) {
          res.status.should.eql(400);
        });
    });

    it('no customer ID', function () {
      return agent
        .post('/key')
        .send({
          coin: 'btc',
          userEmail: 'test@example.com'
        })
        .then(function (res) {
          res.status.should.eql(400);
        })
    });

    it('no coin type', function () {
      return agent
        .post('/key')
        .send({
          customerId: 'enterprise-id',
          userEmail: 'test@example.com'
        })
        .then(function (res) {
          res.status.should.eql(400);
        })
    });

    it('unsupported coin', function () {
      return agent
        .post('/key')
        .send({
          customerId: 'enterprise-id',
          coin: 'bitconnect',
          userEmail: 'test@example.com'
        })
        .then(function (res) {
          res.status.should.eql(400);
        });
    });

    it('should return a new key', function () {
      return agent
        .post('/key')
        .send({
          customerId: 'enterprise-id',
          coin: 'btc',
          userEmail: 'test@example.com',
          custom: {
            'anyCustomField': 'hello world'
          }
        })
        .then(function (res) {
          res.status.should.eql(200);
          should.exist(res.body.path);
          should.exist(res.body.masterKey);
          res.body.masterKey.substr(0, 4).should.equal('xpub');
          should.exist(res.body.xpub);
          res.body.xpub.substr(0, 4).should.equal('xpub');
          res.body.userEmail.should.equal('test@example.com');
          should.exist(res.body.custom);
          should.exist(res.body.custom.anyCustomField);
          res.body.custom.anyCustomField.should.equal('hello world');
        });
    });
  });
});
