import * as R from 'ramda';
import app from './app.js';
import common from './common.js';
import c from './constants.js';

export const REVIEWS_URL_TEMPLATE = 'https://itunes.apple.com/{country}/rss/customerreviews';

function ensureArray (value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function cleanList (results) {
  const reviews = ensureArray(results.feed.entry);
  return reviews.map((review) => ({
    id: review.id.label,
    userName: review.author.name.label,
    userUrl: review.author.uri.label,
    version: review['im:version'].label,
    score: parseInt(review['im:rating'].label),
    title: review.title.label,
    text: review.content.label,
    url: review.link.attributes.href,
    updated: review.updated.label
  }));
}

const reviews = (opts) => {
  opts = opts || {};
  return new Promise((resolve) => {
    validate(opts);

    if (opts.id) {
      resolve(opts.id);
    } else if (opts.appId) {
      resolve(app(opts).then(app => app.id));
    }
  })
    .then((id) => {
      opts.sort = opts.sort || c.sort.RECENT;
      opts.page = opts.page || 1;
      opts.country = common.countryCode(opts.country);

      const url = `https://itunes.apple.com/${opts.country}/rss/customerreviews/page=${opts.page}/id=${id}/sortby=${opts.sort}/json`;
      return common.request(url, {}, opts.requestOptions);
    })
    .then(JSON.parse)
    .then(cleanList);
};

function validate (opts) {
  if (!opts.id && !opts.appId) {
    throw Error('Either id or appId is required');
  }

  if (opts.sort && !R.includes(opts.sort, R.values(c.sort))) {
    throw new Error('Invalid sort ' + opts.sort);
  }

  if (opts.page && opts.page < 1) {
    throw new Error('Page cannot be lower than 1');
  }

  if (opts.page && opts.page > 10) {
    throw new Error('Page cannot be greater than 10');
  }
}

export default reviews;
