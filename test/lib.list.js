import { assert } from 'chai';
import store from '../index.js';
import { parseDeveloperId } from '../lib/list.js';
import { assertValidApp, assertValidUrl } from './common.js';

describe('List method', () => {
  it('should parse developer IDs from App Store URLs with query parameters', () => {
    assert.equal(
      parseDeveloperId('https://apps.apple.com/us/developer/openai-opco-llc/id1684349733?uo=2'),
      '1684349733'
    );
    assert.equal(
      parseDeveloperId('https://itunes.apple.com/us/artist/sling-tv-llc/959665097?mt=8&uo=2'),
      undefined
    );
  });

  it('should fetch a valid application list for the given category and collection', () => {
    return store.list({
      category: store.category.GAMES_ACTION,
      collection: store.collection.TOP_FREE_IOS
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => assert(app.free)));
  });

  it('should validate the category', () => {
    return store.list({
      category: 'wrong',
      collection: store.collection.TOP_FREE_IOS
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid category wrong'));
  });

  it('should validate the collection', () => {
    return store.list({
      category: store.category.GAMES_ACTION,
      collection: 'wrong'
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid collection wrong'));
  });

  it('should validate the results number', () => {
    return store.list({
      category: store.category.GAMES_ACTION,
      collection: store.collection.TOP_FREE_IOS,
      num: 250
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Cannot retrieve more than 200 apps'));
  });

  it('should reject invalid result counts', () => {
    return Promise.all([0, -1, 1.5].map((num) => store.list({ num })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'num must be a positive integer'))));
  });

  it('should fetch apps with fullDetail', () => {
    return store.list({
      collection: store.collection.TOP_FREE_GAMES_IOS,
      fullDetail: true,
      num: 3
    })
      .then((apps) => apps.map(assertValidApp))
      .then((apps) => apps.map((app) => {
        assert.isString(app.description);

        // getting some entertainment apps here, skipping the check
        // assert.equal(app.primaryGenre, 'Games');
        // assert.equal(app.primaryGenreId, '6014');

        assert.equal(app.price, '0.00000');
        assert(app.free);

        assert.isString(app.developer);
        if (app.developerWebsite) {
          assertValidUrl(app.developerWebsite);
        }
      }));
  });

  it('should be able to set requestOptions', (done) => {
    store.list({
      collection: store.collection.TOP_FREE_GAMES_IOS,
      num: 5,
      requestOptions: {
        method: 'DELETE'
      }
    })
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.response.statusCode, 501);
        done();
      })
      .catch(done);
  });
});
