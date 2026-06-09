import { assert } from 'chai';
import store from '../index.js';
import { assertValidApp } from './common.js';

const FACEBOOK_ID = '284882218';

describe('Developer method', () => {
  it('should reject with validation error when called without options', (done) => {
    store.developer()
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'devId is required');
        done();
      })
      .catch(done);
  });

  it('should reject with validation error when devId is missing', (done) => {
    store.developer({})
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'devId is required');
        done();
      })
      .catch(done);
  });

  it('should fetch a valid application list', () => {
    return store.developer({devId: FACEBOOK_ID})
      .then((apps) => {
        apps.map(assertValidApp);
        apps.map((app) => {
          assert.equal(app.developerId, FACEBOOK_ID);
          assert.equal(app.developer, 'Meta Platforms, Inc.');
        });
      });
  });
});
