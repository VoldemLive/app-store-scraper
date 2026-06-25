import * as R from 'ramda';
import memoizee from 'memoizee';
import app from './lib/app.js';
import list, { RSS_CHARTS_URL } from './lib/list.js';
import search, { SEARCH_URL } from './lib/search.js';
import developer from './lib/developer.js';
import privacy from './lib/privacy.js';
import suggest, { SUGGEST_URL } from './lib/suggest.js';
import similar, { SIMILAR_APPS_URL_TEMPLATE } from './lib/similar.js';
import reviews, { REVIEWS_URL_TEMPLATE } from './lib/reviews.js';
import ratings, { RATINGS_URL_TEMPLATE } from './lib/ratings.js';
import versionHistory from './lib/version-history.js';
import { APP_PAGE_URL_TEMPLATE } from './lib/app-page.js';
import { LOOKUP_URL } from './lib/common.js';
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
  APP_PAGE_URL_TEMPLATE,
  category,
  collection,
  developer,
  device,
  LOOKUP_URL,
  list,
  markets,
  privacy,
  RATINGS_URL_TEMPLATE,
  ratings,
  REVIEWS_URL_TEMPLATE,
  reviews,
  RSS_CHARTS_URL,
  search,
  SEARCH_URL,
  similar,
  SIMILAR_APPS_URL_TEMPLATE,
  sort,
  suggest,
  SUGGEST_URL,
  versionHistory
};

export default store;
