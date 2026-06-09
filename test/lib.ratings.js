import { assert } from 'chai';
import store from '../index.js';
import { parseCount, parseRatings } from '../lib/ratings.js';

const id = '553834731';

describe('Ratings method', () => {
  it('should parse plain, grouped, and abbreviated rating counts', () => {
    assert.equal(parseCount('123'), 123);
    assert.equal(parseCount('1,234'), 1234);
    assert.equal(parseCount('265.922 Bewertungen'), 265922);
    assert.equal(parseCount('420 551 notes'), 420551);
    assert.equal(parseCount('420K Ratings'), 420000);
    assert.equal(parseCount('3.9M Ratings'), 3900000);
    assert.equal(parseCount('3,9M Ratings'), 3900000);
    assert.equal(parseCount('1,234K Ratings'), 1234000);
    assert.equal(parseCount('unknown'), 0);
  });

  it('should parse abbreviated rating HTML', () => {
    const html = `
      <div class="rating-count">3.9M Ratings</div>
      <div class="vote"><span class="total">2.5M</span></div>
      <div class="vote"><span class="total">800K</span></div>
      <div class="vote"><span class="total">400K</span></div>
      <div class="vote"><span class="total">150K</span></div>
      <div class="vote"><span class="total">50K</span></div>
    `;

    assert.deepEqual(parseRatings(html), {
      ratings: 3900000,
      histogram: {
        '1': 50000,
        '2': 150000,
        '3': 400000,
        '4': 800000,
        '5': 2500000
      }
    });
  });

  it('should reject with validation error when called without options', (done) => {
    store.ratings()
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'id is required');
        done();
      })
      .catch(done);
  });

  it('should reject with validation error when id is missing', (done) => {
    store.ratings({})
      .then(() => done('should not resolve'))
      .catch((err) => {
        assert.equal(err.message, 'id is required');
        done();
      })
      .catch(done);
  });

  it('should fetch valid ratings data by id', () => {
    return store.ratings({id})
      .then((ratings) => {
        assert.isObject(ratings);
        assert.isNumber(ratings.ratings);
        assert.isObject(ratings.histogram);
        assert.isNumber(ratings.histogram['1']);
        assert.isNumber(ratings.histogram['2']);
        assert.isNumber(ratings.histogram['3']);
        assert.isNumber(ratings.histogram['4']);
        assert.isNumber(ratings.histogram['5']);
      });
  });

  it('should fetch valid ratings data by id and country', () => {
    let ratingsForUs, ratingsForFr;
    return store.ratings({id})
      .then((ratings) => {
        ratingsForUs = ratings;
      })
      .then(() => store.ratings({id, country: 'fr'}))
      .then((ratings) => {
        ratingsForFr = ratings;
      })
      .then(() => {
        assert.notDeepEqual(ratingsForUs, ratingsForFr);
      });
  });
});
