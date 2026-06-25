import * as cheerio from 'cheerio';
import common from './common.js';

export const RATINGS_URL_TEMPLATE = 'https://itunes.apple.com/{country}/customer-reviews/id{id}';

function ratings (opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    if (!opts.id) {
      throw Error('id is required');
    }

    const country = common.countryCode(opts.country);
    const storeFront = common.storeId(country);
    const idValue = opts.id;
    const url = `https://itunes.apple.com/${country}/customer-reviews/id${idValue}?displayable-kind=11`;

    resolve(common.request(url, {
      'X-Apple-Store-Front': `${storeFront},12`
    }, opts.requestOptions));
  })
    .then((html) => {
      if (html.length === 0) {
        throw Error('App not found (404)');
      }

      return parseRatings(html);
    });
}

export default ratings;

function parseCount (text) {
  const match = String(text).trim().toUpperCase().match(/([\d.,\s\u00A0\u202F]*\d)(?:\s*([KMB])(?=\s|$))?/);
  if (!match) {
    return 0;
  }

  const suffix = match[2];
  const value = match[1].replace(/[\s\u00A0\u202F]/g, '');
  const decimalMatch = suffix && value.match(/[.,](?=\d{1,2}$)/);
  const decimalSeparator = decimalMatch && decimalMatch[0];
  const normalized = decimalSeparator
    ? value.replace(new RegExp(`\\${decimalSeparator}(?=\\d{1,2}$)`), '#').replace(/[.,]/g, '').replace('#', '.')
    : value.replace(/[.,]/g, '');
  const multiplier = {
    K: 1000,
    M: 1000000,
    B: 1000000000
  }[suffix] || 1;

  return Math.round(parseFloat(normalized) * multiplier);
}

function parseRatings (html) {
  const $ = cheerio.load(html);

  const ratings = parseCount($('.rating-count').text());

  const ratingsByStar = $('.vote .total').map((i, el) => parseCount($(el).text())).get();

  const histogram = ratingsByStar.reduce((acc, ratingsForStar, index) => {
    return Object.assign(acc, { [5 - index]: ratingsForStar });
  }, {});

  return { ratings, histogram };
}

export { parseCount, parseRatings };
