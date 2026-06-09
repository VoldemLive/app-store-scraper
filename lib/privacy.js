import appPage from './app-page.js';

function privacy (opts) {
  opts = opts || {};

  return new Promise((resolve) => {
    if (opts.id) {
      resolve(appPage.fetch(opts));
    } else {
      throw Error('id is required');
    }
  })
    .then(parsePrivacy);
}

export default privacy;

function cleanCategory (category) {
  return {
    dataCategory: category.title,
    identifier: category.identifier,
    dataTypes: category.dataTypes || []
  };
}

function cleanPurpose (purpose) {
  return {
    purpose: purpose.title,
    identifier: purpose.identifier,
    dataCategories: (purpose.categories || []).map(cleanCategory)
  };
}

function cleanPrivacyType (privacyType) {
  return {
    privacyType: privacyType.title,
    identifier: privacyType.identifier,
    description: privacyType.detail,
    dataCategories: (privacyType.categories || []).map(cleanCategory),
    purposes: (privacyType.purposes || []).map(cleanPurpose)
  };
}

function parsePrivacy (page) {
  const privacyShelf = page.shelfMapping.privacyTypes;
  const summaryItems = privacyShelf && privacyShelf.items;

  if (!summaryItems) {
    throw Error('Privacy details not found');
  }

  const detailShelf = summaryItems[0] &&
    summaryItems[0].clickAction &&
    summaryItems[0].clickAction.pageData &&
    summaryItems[0].clickAction.pageData.shelves &&
    summaryItems[0].clickAction.pageData.shelves.find((shelf) => shelf.contentType === 'privacyType');
  const privacyTypes = (detailShelf && detailShelf.items) || summaryItems;

  return {
    managePrivacyChoicesUrl: null,
    privacyTypes: privacyTypes.map(cleanPrivacyType)
  };
}
