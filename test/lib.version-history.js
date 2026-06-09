import { assert } from 'chai';
import store from '../index.js';

function assertValid (versionHistoryType) {
  assert.isString(versionHistoryType.versionDisplay);
  assert.isString(versionHistoryType.releaseNotes);
  assert.isString(versionHistoryType.releaseDate);
  assert.isString(versionHistoryType.releaseTimestamp);
}

describe('Version History method', () => {
  it('should retrieve the version history of an app', () => {
    return store.versionHistory({ id: '324684580' })
      .then((versionHistory) => {
        assert(versionHistory);
        assert(versionHistory.length > 0);
        versionHistory.map(assertValid);
      });
  });
});
