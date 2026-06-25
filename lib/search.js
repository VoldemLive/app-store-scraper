import * as R from 'ramda';
import common from './common.js';
export const SEARCH_URL = 'https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search';
const BASE_URL = `${SEARCH_URL}?clientApplication=Software&media=software&term=`;

// TODO find out if there's a way to filter by device
// TODO refactor to allow memoization of the first request

function paginate (num, page) {
  num = num === undefined ? 50 : num;
  page = page === undefined ? 0 : page - 1;
  const pageStart = num * page;
  const pageEnd = pageStart + num;
  return R.slice(pageStart, pageEnd);
}

function validate (opts) {
  if (!opts.term) {
    throw Error('term is required');
  }

  if (opts.num !== undefined && (!Number.isInteger(opts.num) || opts.num < 1)) {
    throw Error('num must be a positive integer');
  }

  if (opts.num > 200) {
    throw Error('Cannot retrieve more than 200 apps');
  }

  if (opts.page !== undefined && (!Number.isInteger(opts.page) || opts.page < 1)) {
    throw Error('page must be a positive integer');
  }
}

function search (opts) {
  return new Promise(function (resolve, reject) {
    opts = opts || {};
    validate(opts);
    opts.country = common.countryCode(opts.country);

    const url = BASE_URL + encodeURIComponent(opts.term);
    const storeId = common.storeId(opts.country);
    const lang = opts.lang || 'en-us';

    common.request(
      url,
      {
        'X-Apple-Store-Front': `${storeId},24 t:native`,
        'Accept-Language': lang
      },
      opts.requestOptions
    )
      .then(JSON.parse)
      .then((response) => (response.bubbles[0] && response.bubbles[0].results) || [])
      .then(paginate(opts.num, opts.page))
      .then(R.pluck('id'))
      .then((ids) => {
        if (!opts.idsOnly) {
          return common.lookup(ids, 'id', opts.country, opts.lang, opts.requestOptions, opts.throttle);
        }
        return ids;
      })
      .then(resolve)
      .catch(reject);
  });
}

export default search;
