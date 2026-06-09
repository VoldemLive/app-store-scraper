'use strict';

const appPage = require('./app-page');

function versionHistory (opts) {
  opts = opts || {};
  opts.country = opts.country || 'US';

  return new Promise((resolve) => {
    if (opts.id) {
      resolve(appPage.fetch(opts));
    } else {
      throw Error('id is required');
    }
  })
    .then(parseVersionHistory);
}

module.exports = versionHistory;

function parseVersionHistory (page) {
  const versionShelf = page.shelfMapping.mostRecentVersion;
  const pageData = versionShelf && versionShelf.seeAllAction && versionShelf.seeAllAction.pageData;
  const historyShelf = pageData && pageData.shelves &&
    pageData.shelves.find((shelf) => shelf.contentType === 'titledParagraph');

  if (!historyShelf || !historyShelf.items) {
    throw Error('Version history not found');
  }

  return historyShelf.items.map((version) => {
    const timestamp = new Date(version.secondarySubtitle);
    if (isNaN(timestamp.getTime())) {
      throw Error('Unable to parse version history release date');
    }

    return {
      versionDisplay: version.primarySubtitle,
      releaseNotes: version.text,
      releaseDate: timestamp.toISOString().slice(0, 10),
      releaseTimestamp: timestamp.toISOString()
    };
  });
}
