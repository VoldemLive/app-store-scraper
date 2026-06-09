import xml2js from 'xml2js';
import common from './common.js';

const { parseString } = xml2js;

const BASE_URL = 'https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=';

function parseXML (string) {
  return new Promise(function (resolve, reject) {
    return parseString(string, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });
}

function extractSuggestions (xml) {
  const toJSON = (item) => ({
    term: item.string[0]
  });

  const list = xml.plist.dict[0].array[0].dict || [];
  return list.map(toJSON);
}

// TODO see language Accept-Language: en-us, en;q=0.50

function suggest (opts) {
  return new Promise(function (resolve) {
    if (!opts && !opts.term) {
      throw Error('term missing');
    }

    opts.country = common.countryCode(opts.country);
    return resolve(BASE_URL + encodeURIComponent(opts.term));
  })
    .then(url => common.request(url, {'X-Apple-Store-Front': `${common.storeId(opts.country)},29`}, opts.requestOptions))
    .then(parseXML)
    .then(extractSuggestions);
}

export default suggest;
