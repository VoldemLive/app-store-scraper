import * as R from 'ramda';
import common from './common.js';

export const GROUPING_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping';
export const ROOM_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewRoom';

const STORE_FRONT_HEADER = 'X-Apple-Store-Front';

// Discovered via enumeration: genreId → groupingId (iOS App Store only)
export const GENRE_GROUPING_MAP = {
  36: 25204, // App Store
  4004: 25300, // Kids
  6000: 25148, // Business
  6001: 25292, // Weather
  6002: 25284, // Utilities
  6003: 25276, // Travel
  6004: 25268, // Sports
  6005: 25260, // Social Networking
  6006: 25252, // Reference
  6007: 25244, // Productivity
  6008: 25236, // Photo & Video
  6009: 25228, // News
  6010: 25220, // Navigation
  6011: 25212, // Music
  6012: 25196, // Lifestyle
  6013: 25188, // Health & Fitness
  6014: 25180, // Games
  6015: 25172, // Finance
  6016: 25164, // Entertainment
  6017: 25156 // Education
};

function extractFcId (seeAllUrl) {
  if (!seeAllUrl) return undefined;
  const match = seeAllUrl.match(/fcId=(\d+)/);
  return match ? match[1] : undefined;
}

function parseSections (model) {
  const sections = [];
  for (const child of (model.children || [])) {
    for (const inner of (child.children || [])) {
      const fcId = extractFcId(inner.seeAllUrl);
      if (inner.name && fcId) {
        sections.push({
          name: inner.name,
          roomId: fcId,
          appCount: (inner.content || []).length,
          seeAllUrl: inner.seeAllUrl
        });
      }
    }
  }
  return sections;
}

function parseGroupingResponse (body) {
  const parsed = JSON.parse(body);
  const pageData = parsed.pageData;
  if (!pageData || !pageData.fcStructure) {
    throw Error('Unable to parse grouping response');
  }
  return {
    genreId: Number(pageData.genreId),
    sections: parseSections(pageData.fcStructure.model)
  };
}

function parseRoomResponse (body) {
  const parsed = JSON.parse(body);
  const results = parsed && parsed.storePlatformData && parsed.storePlatformData.lockup && parsed.storePlatformData.lockup.results;
  const adamIds = parsed && parsed.pageData && parsed.pageData.adamIds;
  if (!results || !adamIds) {
    throw Error('Unable to parse room response');
  }
  return adamIds
    .map(id => results[String(id)])
    .filter(Boolean)
    .map(app => ({
      id: Number(app.id !== undefined ? app.id : app.adamId),
      appId: app.bundleId,
      title: app.name,
      developer: app.artistName,
      icon: app.artwork ? app.artwork.url : undefined,
      url: app.url
    }));
}

function validateGrouping (opts) {
  if (opts.genreId !== undefined && opts.groupingId !== undefined) {
    throw Error('Provide exactly one of genreId or groupingId');
  }
  if (opts.genreId !== undefined) {
    if (!Number.isInteger(opts.genreId) || opts.genreId < 1) {
      throw Error('genreId must be a positive integer');
    }
    const gid = GENRE_GROUPING_MAP[opts.genreId];
    if (gid === undefined) {
      throw Error(`No editorial grouping exists for genreId ${opts.genreId}`);
    }
    opts.groupingId = gid;
  } else if (opts.groupingId !== undefined) {
    if (!Number.isInteger(opts.groupingId) || opts.groupingId < 1) {
      throw Error('groupingId must be a positive integer');
    }
  } else {
    throw Error('Provide genreId or groupingId');
  }
  opts.country = common.countryCode(opts.country);
}

function validateRoom (opts) {
  if (typeof opts.roomId !== 'string' || opts.roomId.trim().length === 0) {
    throw Error('roomId is required');
  }
  if (opts.genreId !== undefined && (!Number.isInteger(opts.genreId) || opts.genreId < 1)) {
    throw Error('genreId must be a positive integer');
  }
  opts.country = common.countryCode(opts.country);
}

function grouping (opts) {
  return new Promise(function (resolve, reject) {
    opts = R.clone(opts || {});
    validateGrouping(opts);

    const storeId = common.storeId(opts.country);
    const url = `${GROUPING_URL}?id=${opts.groupingId}&cc=${opts.country}`;
    common.request(url, { [STORE_FRONT_HEADER]: `${storeId}-1,29` }, opts.requestOptions)
      .then(parseGroupingResponse)
      .then(resolve)
      .catch(reject);
  });
}

function room (opts) {
  return new Promise(function (resolve, reject) {
    opts = R.clone(opts || {});
    validateRoom(opts);

    const storeId = common.storeId(opts.country);
    const genreParam = opts.genreId ? `&genreIdString=${opts.genreId}` : '';
    const url = `${ROOM_URL}?fcId=${opts.roomId}${genreParam}&mediaTypeString=Mobile+Software+Applications&cc=${opts.country}`;
    common.request(url, { [STORE_FRONT_HEADER]: `${storeId}-1,29` }, opts.requestOptions)
      .then(parseRoomResponse)
      .then(resolve)
      .catch(reject);
  });
}

export { grouping, room };
export default { grouping, room };
