import { assert } from 'chai';
import store from '../index.js';
import { assertValidUrl } from './common.js';

function assertValid (review) {
  assert.isString(review.id);
  assert(review.id);
  assert.isString(review.userName);
  assert(review.userName);
  assert.isString(review.title);
  assert.isString(review.text);
  assert.isNumber(review.score);
  assert(review.score > 0);
  assert(review.score <= 5);
  assertValidUrl(review.url);
  assert.isNotNull(new Date(review.updated).toJSON());
  assert.isString(review.updated);
  assert(review.updated);
}

describe('Reviews method', () => {
  it('should reject with validation error when called without options', (done) => {
    store.reviews()
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'Either id or appId is required');
        done();
      })
      .catch(done);
  });

  it('should reject with validation error when id and appId are both missing', (done) => {
    store.reviews({})
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'Either id or appId is required');
        done();
      })
      .catch(done);
  });

  it('should retrieve the reviews of an app', () => {
    return store.reviews({id: '553834731'})
      .then((reviews) => {
        reviews.map(assertValid);
      });
  });

  it('should validate the sort', () => {
    return store.reviews({
      id: '553834731',
      sort: 'invalid'
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Invalid sort invalid'));
  });

  it('should validate the page', () => {
    return store.reviews({
      id: '553834731',
      page: 11
    })
      .then(assert.fail)
      .catch((e) => assert.equal(e.message, 'Page cannot be greater than 10'));
  });

  it('should be able to set requestOptions', (done) => {
    store.reviews({
      id: '553834731',
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
