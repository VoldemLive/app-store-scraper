'use strict';

const assert = require('chai').assert;
const appPage = require('../lib/app-page');
const common = require('../lib/common');

describe('App page parser', () => {
  it('should parse serialized App Store data', () => {
    const result = appPage.parse(
      '<script id="serialized-server-data" type="application/json">' +
      '{"data":[{"data":{"shelfMapping":{"privacyTypes":{"items":[]}}}}]}' +
      '</script>'
    );

    assert.deepEqual(result.shelfMapping.privacyTypes.items, []);
  });

  it('should reject a page without serialized App Store data', () => {
    assert.throws(
      () => appPage.parse('<html></html>'),
      'Unable to find serialized App Store data'
    );
  });

  it('should reject malformed serialized App Store data', () => {
    assert.throws(
      () => appPage.parse('<script id="serialized-server-data">{</script>'),
      'Unable to parse serialized App Store data'
    );
  });

  it('should report missing apps consistently', () => {
    const request = common.request;
    common.request = () => Promise.reject({ response: { statusCode: 404 } });

    return appPage.fetch({ id: '123' })
      .then(assert.fail)
      .catch((error) => assert.equal(error.message, 'App not found (404)'))
      .finally(() => {
        common.request = request;
      });
  });
});
