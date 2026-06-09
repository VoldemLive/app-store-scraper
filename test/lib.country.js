import { assert } from 'chai';
import store from '../index.js';
import common from '../lib/common.js';

describe('App Store country validation', () => {
  it('defaults to the US storefront and normalizes supported country codes', () => {
    assert.equal(common.countryCode(), 'us');
    assert.equal(common.countryCode('FR'), 'fr');
    assert.equal(common.storeId(), store.markets.US);
    assert.equal(common.storeId('fr'), store.markets.FR);
  });

  it('rejects unsupported and malformed country codes', () => {
    [null, '', 'u', 'usa', 'zz', 123].forEach((country) => {
      assert.throws(
        () => common.countryCode(country),
        `Unsupported country code ${String(country)}`
      );
    });
  });

  it('rejects unsupported countries before public methods make requests', () => {
    const calls = [
      () => store.app({ id: 553834731, country: 'zz' }),
      () => store.list({ country: 'zz' }),
      () => store.search({ term: 'calendar', country: 'zz' }),
      () => store.developer({ devId: 284882218, country: 'zz' }),
      () => store.privacy({ id: 553834731, country: 'zz' }),
      () => store.suggest({ term: 'cal', country: 'zz' }),
      () => store.similar({ id: 553834731, country: 'zz' }),
      () => store.reviews({ id: 553834731, country: 'zz' }),
      () => store.ratings({ id: 553834731, country: 'zz' }),
      () => store.versionHistory({ id: 553834731, country: 'zz' })
    ];

    return Promise.all(calls.map(call => (
      call()
        .then(assert.fail)
        .catch(error => assert.equal(error.message, 'Unsupported country code zz'))
    )));
  });
});
