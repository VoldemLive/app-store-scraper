import createDebug from 'debug';
import createThrottledRequest from 'throttled-request';
import request from './http-client.js';
import c from './constants.js';

const debug = createDebug('app-store-scraper');
const throttles = new Map();

function cleanApp (app) {
  return {
    id: app.trackId,
    appId: app.bundleId,
    title: app.trackName,
    url: app.trackViewUrl,
    description: app.description,
    icon: app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60,
    genres: app.genres,
    genreIds: app.genreIds,
    primaryGenre: app.primaryGenreName,
    primaryGenreId: app.primaryGenreId,
    contentRating: app.contentAdvisoryRating,
    languages: app.languageCodesISO2A,
    size: app.fileSizeBytes,
    requiredOsVersion: app.minimumOsVersion,
    released: app.releaseDate,
    updated: app.currentVersionReleaseDate || app.releaseDate,
    releaseNotes: app.releaseNotes,
    version: app.version,
    price: app.price,
    currency: app.currency,
    free: app.price === 0,
    developerId: app.artistId,
    developer: app.artistName,
    developerUrl: app.artistViewUrl,
    developerWebsite: app.sellerUrl,
    score: app.averageUserRating,
    reviews: app.userRatingCount,
    currentVersionScore: app.averageUserRatingForCurrentVersion,
    currentVersionReviews: app.userRatingCountForCurrentVersion,
    screenshots: app.screenshotUrls,
    ipadScreenshots: app.ipadScreenshotUrls,
    appletvScreenshots: app.appletvScreenshotUrls,
    supportedDevices: app.supportedDevices
  };
}

// TODO add an optional parse function
function requestForLimit (limit) {
  if (limit === undefined) {
    return request;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw Error('throttle must be a positive integer');
  }
  if (!throttles.has(limit)) {
    const throttled = createThrottledRequest(request);
    throttled.configure({
      requests: limit,
      milliseconds: 1000
    });
    throttles.set(limit, throttled);
  }

  return throttles.get(limit);
}

const doRequest = (url, headers, requestOptions, limit) => new Promise(function (resolve, reject) {
  debug('Making request: %s %j %o', url, headers, requestOptions);

  requestOptions = Object.assign({ method: 'GET' }, requestOptions);

  let req;
  try {
    req = requestForLimit(limit);
  } catch (error) {
    return reject(error);
  }
  req(Object.assign({ url, headers }, requestOptions), (error, response, body) => {
    if (error) {
      debug('Request error', error);
      return reject(error);
    }
    if (response.statusCode >= 400) {
      const error = Error(`Request failed with status code ${response.statusCode}`);
      error.response = response;
      error.body = body;
      return reject(error);
    }
    debug('Finished request');
    resolve(body);
  });
});

export const LOOKUP_URL = 'https://itunes.apple.com/lookup';

function lookup (ids, idField, country, lang, requestOptions, limit) {
  idField = idField || 'id';
  country = countryCode(country);
  const langParam = lang ? `&lang=${lang}` : '';
  const joinedIds = ids.join(',');
  const url = `${LOOKUP_URL}?${idField}=${joinedIds}&country=${country}&entity=software${langParam}`;
  return doRequest(url, {}, requestOptions, limit)
    .then(JSON.parse)
    .then((res) => res.results.filter(function (app) {
      return typeof app.wrapperType === 'undefined' || app.wrapperType === 'software';
    }))
    .then((res) => res.map(cleanApp));
}

function storeId (countryCode) {
  const markets = c.markets;
  return markets[normalizeCountry(countryCode).toUpperCase()];
}

function normalizeCountry (value) {
  const country = value === undefined ? 'us' : value;
  if (typeof country !== 'string' || !Object.hasOwn(c.markets, country.toUpperCase())) {
    throw Error(`Unsupported country code ${String(country)}`);
  }
  return country.toLowerCase();
}

const countryCode = normalizeCountry;

export { cleanApp, countryCode, lookup, doRequest as request, storeId };
export default { cleanApp, countryCode, lookup, request: doRequest, storeId };
