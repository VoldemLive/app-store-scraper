import app from './app.js';
import common from './common.js';

export const SIMILAR_APPS_URL_TEMPLATE = 'https://itunes.apple.com/us/app/app/id{id}';
const BASE_URL = 'https://itunes.apple.com/us/app/app/id';

function similar (opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    opts.country = common.countryCode(opts.country);
    if (opts.id) {
      resolve(opts.id);
    } else if (opts.appId) {
      app(opts).then((app) => resolve(app.id)).catch(reject);
    } else {
      throw Error('Either id or appId is required');
    }
  })
    .then((id) => common.request(
      `${BASE_URL}${id}`,
      {
        'X-Apple-Store-Front': `${common.storeId(opts.country)},32`
      },
      opts.requestOptions
    ))
    .then(function (text) {
      const index = text.indexOf('customersAlsoBoughtApps');
      if (index === -1) {
        return [];
      }
      const regExp = /customersAlsoBoughtApps":(.*?\])/g;
      const match = regExp.exec(text);
      const ids = JSON.parse(match[1]);

      return common.lookup(ids, 'id', opts.country, opts.lang, opts.requestOptions, opts.throttle);
    });
}

export default similar;
