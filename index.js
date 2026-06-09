import * as R from 'ramda';
import memoizee from 'memoizee';
import app from './lib/app.js';
import list from './lib/list.js';
import search from './lib/search.js';
import developer from './lib/developer.js';
import privacy from './lib/privacy.js';
import suggest from './lib/suggest.js';
import similar from './lib/similar.js';
import reviews from './lib/reviews.js';
import ratings from './lib/ratings.js';
import versionHistory from './lib/version-history.js';
import constants, { category, collection, device, markets, sort } from './lib/constants.js';

const methods = {
  app,
  list,
  search,
  developer,
  privacy,
  suggest,
  similar,
  reviews,
  ratings,
  versionHistory
};

export function memoized (opts) {
  const cacheOpts = Object.assign({
    primitive: true,
    normalizer: JSON.stringify,
    maxAge: 1000 * 60 * 5, // cache for 5 minutes
    max: 1000 // save up to 1k results to avoid memory issues
  }, opts);
  const doMemoize = (fn) => memoizee(fn, cacheOpts);
  return Object.assign({}, constants, R.map(doMemoize, methods));
}

const store = Object.assign({memoized}, constants, methods);

export {
  app,
  category,
  collection,
  developer,
  device,
  list,
  markets,
  privacy,
  ratings,
  reviews,
  search,
  similar,
  sort,
  suggest,
  versionHistory
};

export default store;
