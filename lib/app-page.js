import * as cheerio from 'cheerio';
import common from './common.js';

function parseAppPage (html) {
  const $ = cheerio.load(html);
  const serializedData = $('#serialized-server-data').html();

  if (!serializedData) {
    throw Error('Unable to find serialized App Store data');
  }

  let page;
  try {
    page = JSON.parse(serializedData);
  } catch (error) {
    throw Error('Unable to parse serialized App Store data');
  }

  const appPage = page.data && page.data[0] && page.data[0].data;
  if (!appPage || !appPage.shelfMapping) {
    throw Error('Unable to find app data in serialized App Store data');
  }

  return appPage;
}

function fetchAppPage (opts) {
  const country = common.countryCode(opts.country);
  const url = `https://apps.apple.com/${country}/app/id${opts.id}`;

  return common.request(url, {}, opts.requestOptions)
    .then(parseAppPage)
    .catch((error) => {
      if (error.response && error.response.statusCode === 404) {
        throw Error('App not found (404)');
      }

      throw error;
    });
}

export { fetchAppPage as fetch, parseAppPage as parse };
export default { fetch: fetchAppPage, parse: parseAppPage };
