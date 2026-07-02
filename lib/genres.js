import * as R from 'ramda';
import common from './common.js';

export const GENRES_URL = 'https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres';

function parseGenre (raw) {
  const genre = {
    id: Number(raw.id),
    name: raw.name,
    url: raw.url
  };
  if (raw.subgenres && Object.keys(raw.subgenres).length > 0) {
    genre.subcategories = Object.values(raw.subgenres).map(parseGenre);
  }
  return genre;
}

function parseResponse (body, rootId) {
  const parsed = JSON.parse(body);
  const root = parsed[String(rootId)];
  if (!root) {
    throw Error(`Genre ${rootId} not found in response`);
  }
  return parseGenre(root);
}

function validate (opts) {
  opts.id = opts.id === undefined ? 36 : opts.id;
  if (!Number.isInteger(opts.id) || opts.id < 1) {
    throw Error('id must be a positive integer');
  }
  opts.country = common.countryCode(opts.country);
}

function genres (opts) {
  return new Promise(function (resolve, reject) {
    opts = R.clone(opts || {});
    validate(opts);

    const url = `${GENRES_URL}?id=${opts.id}&cc=${opts.country}`;
    common.request(url, {}, opts.requestOptions)
      .then(body => parseResponse(body, opts.id))
      .then(resolve)
      .catch(reject);
  });
}

export default genres;
