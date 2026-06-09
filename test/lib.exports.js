import { assert } from 'chai';
import store, * as named from 'app-store-scraper';

describe('Package exports', () => {
  it('should expose the public API through default and named exports', () => {
    [
      'app',
      'developer',
      'list',
      'memoized',
      'privacy',
      'ratings',
      'reviews',
      'search',
      'similar',
      'suggest',
      'versionHistory'
    ].forEach((method) => {
      assert.strictEqual(named[method], store[method]);
    });

    [
      'category',
      'collection',
      'device',
      'markets',
      'sort'
    ].forEach((constant) => {
      assert.strictEqual(named[constant], store[constant]);
    });
  });
});
