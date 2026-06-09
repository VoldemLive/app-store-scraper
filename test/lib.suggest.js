import { assert } from 'chai';
import store from '../index.js';

describe('Suggest method', () => {
  it('should return suggestions for a common term', () => store.suggest({term: 'p'})
    .then((results) => {
      assert.equal(results.length, 10, `expected ${results} to have 10 elements`);
      results.map((r) => assert.include(r.term, 'p'));
    }));

  it('should reject missing and empty terms', () => {
    return Promise.all([
      store.suggest(),
      store.suggest({}),
      store.suggest({ term: '' }),
      store.suggest({ term: '  ' })
    ].map((promise) => promise
      .then(assert.fail)
      .catch((error) => assert.equal(error.message, 'term is required'))));
  });

  it('should be able to set requestOptions', (done) => {
    store.suggest({
      term: 'p',
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
