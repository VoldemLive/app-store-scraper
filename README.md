# app-store-scraper

App Store market data scraper with a local Model Context Protocol (MCP) server.
The scraper covers app metadata, search, charts, developer catalogs,
suggestions, similar apps, reviews, ratings, privacy disclosures, and version
history.

## Local setup

Requirements:

- Node.js 20.18.1 or newer for the complete repository and MCP server.
- Network access to Apple's public App Store endpoints.

```sh
git clone https://github.com/VoldemLive/app-store-scraper.git
cd app-store-scraper
npm run setup
```

The scraper is an ES module. CommonJS `require()` is not supported.

Methods with a `country` option support the App Store storefronts exported by
`store.markets`. Country codes are case-insensitive, default to `us` when
omitted, and are rejected when the storefront is unsupported.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install scraper and MCP dependencies |
| `npm start` | Build and start the stdio MCP server |
| `npm run build` | Compile the TypeScript MCP server |
| `npm test` | Run scraper tests, including live App Store integration checks |
| `npm run check` | Run scraper lint/tests/secret scan and all MCP checks |

## Security

Run `npm run check:secrets` before committing. Apple Ads and other credentials
must be stored outside the repository and supplied at runtime. See
[Apple Ads credential security](docs/security/apple-ads-credentials.md) for
configuration, verification, rotation, and incident-response guidance.

## MCP server

The implemented [TypeScript stdio MCP server](packages/mcp-server/README.md)
exposes every current scraper capability through ten read-only tools and
provides a local raw market-hunt vector compiler. It also
provides App Store reference resources, reusable market-analysis prompts,
bounded responses, cancellation, caching, retries, throttling, and normalized
errors.

Start it from the repository root:

```sh
npm start
```

Apple Ads is intentionally limited to an unsupported provider contract stub.
OCR and remote HTTP transport are deferred and are not required for the local
App Store scraper or stdio MCP server.

## Usage
Available methods:
- [app](#app): Retrieves the full detail of an application.
- [list](#list): Retrieves a list of applications from one of the collections at iTunes.
- [search](#search): Retrieves apps matching the given search term.
- [developer](#developer): Retrieves a list of apps by the given developer id.
- [privacy](#privacy): Retrieves the privacy disclosures for the app.
- [suggest](#suggest): Retrieves suggestions that complete a partial search term.
- [similar](#similar): Returns the list of "customers also bought" apps shown in the app's detail page.
- [reviews](#reviews): Retrieves a page of reviews for the app.
- [ratings](#ratings): Retrieves the country-specific rating count and star histogram for the app.
- [versionHistory](#versionHistory): Retrieves the version history for the app.

### app
Retrieves the full detail of an application. Options:

* `id`: the iTunes "trackId" of the app, for example `553834731` for Candy Crush Saga. Either this or the `appId` should be provided.
* `appId`: the iTunes "bundleId" of the app, for example `com.midasplayer.apps.candycrushsaga` for Candy Crush Saga. Either this or the `id` should be provided.
* `country`: the two letter country code to get the app details from. Defaults to `us`. Note this also affects the language of the data.
* `lang`: language code for the result text. Defaults to undefined, so country specific language should be used automatically.
* `ratings`: load additional rating count and star histogram information.

Example:

```javascript
import store from 'app-store-scraper';

store.app({id: 553834731}).then(console.log).catch(console.log);
```

Results:

```javascript
{ id: 553834731,
  appId: 'com.midasplayer.apps.candycrushsaga',
  title: 'Candy Crush Saga',
  url: 'https://itunes.apple.com/us/app/candy-crush-saga/id553834731?mt=8&uo=4',
  description: 'Candy Crush Saga, from the makers of Candy Crush ...',
  icon: 'http://is5.mzstatic.com/image/thumb/Purple30/v4/7a/e4/a9/7ae4a9a9-ff68-cbe4-eed6-fe0a246e625d/source/512x512bb.jpg',
  genres: [ 'Games', 'Entertainment', 'Puzzle', 'Arcade' ],
  genreIds: [ '6014', '6016', '7012', '7003' ],
  primaryGenre: 'Games',
  primaryGenreId: 6014,
  contentRating: '4+',
  languages: [ 'EN', 'JA' ],
  size: '73974859',
  requiredOsVersion: '5.1.1',
  released: '2012-11-14T14:41:32Z',
  updated: '2016-05-31T06:39:52Z',
  releaseNotes: 'We are back with a tasty Candy Crush Saga update ...',
  version: '1.76.1',
  price: 0,
  currency: 'USD',
  free: true,
  developerId: 526656015,
  developer: 'King',
  developerUrl: 'https://itunes.apple.com/us/developer/king/id526656015?uo=4',
  developerWebsite: undefined,
  score: 4,
  reviews: 818816,
  currentVersionScore: 4.5,
  currentVersionReviews: 1323,
  screenshots:
   [ 'http://a3.mzstatic.com/us/r30/Purple49/v4/7a/8a/a0/7a8aa0ec-976d-801f-0bd9-7b753fdaf93c/screen1136x1136.jpeg',
     ... ],
  ipadScreenshots:
   [ 'http://a1.mzstatic.com/us/r30/Purple49/v4/db/45/cf/db45cff9-bdb6-0832-157f-ac3f14565aef/screen480x480.jpeg',
     ... ],
  appletvScreenshots: [],
  supportedDevices:
   [ 'iPhone-3GS',
     'iPadWifi',
     ... ]}
```

Example with `ratings` option:

```javascript
import store from 'app-store-scraper';

store.app({id: 553834731, ratings: true}).then(console.log).catch(console.log);
```

Results:

```javascript
{ id: 553834731,
  appId: 'com.midasplayer.apps.candycrushsaga',

  // ... like above

  ratings: 652230,
  histogram: {
    '1': 7004,
    '2': 6650,
    '3': 26848,
    '4': 140625,
    '5': 471103
  }
}
```

### list

Retrieves a list of applications from one of the collections at iTunes. Options:

* `collection`: the collection to look up. Defaults to `collection.TOP_FREE_IOS`, available options can be found in [`lib/constants.js`](lib/constants.js).
* `category`: the category to look up. This is a number associated with the genre for the application. Defaults to no specific category. Available options can be found in [`lib/constants.js`](lib/constants.js).
* `country`: the two letter country code to get the list from. Defaults to `us`.
* `lang`: language code for the result text. Defaults to undefined, so country specific language should be used automatically.
* `num`: the amount of elements to retrieve. Defaults to `50`, maximum
  allowed is `200`.
* `fullDetail`: If this is set to `true`, an extra request will be
  made to get extra attributes of the resulting applications (like
  those returned by the `app` method).

Example:

```js
import store from 'app-store-scraper';

store.list({
  collection: store.collection.TOP_FREE_IPAD,
  category: store.category.GAMES_ACTION,
  num: 2
})
.then(console.log)
.catch(console.log);
```

Returns:

```js
[ { id: '1091944550',
    appId: 'com.hypah.io.slither',
    title: 'slither.io',
    icon: 'http://is4.mzstatic.com/image/thumb/Purple30/v4/68/d7/4d/68d74df4-f4e7-d4a4-a8ea-dbab686e5554/mzl.ujmngosn.png/100x100bb-85.png',
    url: 'https://itunes.apple.com/us/app/slither.io/id1091944550?mt=8&uo=2',
    price: 0,
    currency: 'USD',
    free: true,
    description: 'Play against other people online! ...',
    developer: 'Steve Howse',
    developerUrl: 'https://itunes.apple.com/us/developer/steve-howse/id867992583?mt=8&uo=2',
    developerId: '867992583',
    genre: 'Games',
    genreId: '6014',
    released: '2016-03-25T10:01:46-07:00' },
  { id: '1046846443',
    appId: 'com.ubisoft.hungrysharkworld',
    title: 'Hungry Shark World',
    icon: 'http://is5.mzstatic.com/image/thumb/Purple60/v4/08/1a/8d/081a8d06-b4d5-528b-fa8e-f53646b6f797/mzl.ehtjvlft.png/100x100bb-85.png',
    url: 'https://itunes.apple.com/us/app/hungry-shark-world/id1046846443?mt=8&uo=2',
    price: 0,
    currency: 'USD',
    free: true,
    description: 'The stunning sequel to Hungry ...',
    developer: 'Ubisoft',
    developerUrl: 'https://itunes.apple.com/us/developer/ubisoft/id317644720?mt=8&uo=2',
    developerId: '317644720',
    genre: 'Games',
    genreId: '6014',
    released: '2016-05-04T09:43:06-07:00' } ]
```

### search

Retrieves apps matching the given search term. Options:

* `term`: the term to search for (required).
* `num`: the amount of elements to retrieve. Defaults to `50`, maximum allowed is `200`.
* `page`: page of results to retrieve. Defaults to `1`.
* `country`: the two letter country code to search in. Defaults to `us`.
* `lang`: language code for the result text. Defaults to `en-us`.
* `idsOnly`: (optional, defaults to `false`): skip extra lookup request. Search results will contain array of application ids.

Example:

```js
import store from 'app-store-scraper';

store.search({
  term: 'panda',
  num: 2,
  page: 3,
  country: 'us',
  lang: 'en-us'
})
.then(console.log)
.catch(console.log);
```

Results:

```js
[
  { id: 903990394,
    appId: 'com.pandarg.pxmobileapp',
    title: 'Panda Express Chinese Kitchen',
    (...)
  },
  {
    id: 700970012,
    appId: 'com.sgn.pandapop',
    title: 'Panda Pop',
    (...)
  }
]
```

### developer
Retrieves a list of applications by the given developer id. Options:

* `devId`: the required iTunes "artistId" of the developer, for example `284882218` for Facebook.
* `country`: the two letter country code to get the app details from. Defaults to `us`. Note this also affects the language of the data.
* `lang`: language code for the result text. Defaults to undefined, so country specific language should be used automatically.

Example:

```javascript
import store from 'app-store-scraper';

store.developer({devId: 284882218}).then(console.log).catch(console.log);
```

Results:

```js
[
  { id: 284882215,
    appId: 'com.facebook.Facebook',
    title: 'Facebook',
    (...)
  },
  { id: 454638411,
    appId: 'com.facebook.Messenger',
    title: 'Messenger',
    (...)
  },
  (...)
]
```

### privacy

Retrieves the App Store privacy disclosures for the app. Options:

* `id`: the required iTunes "trackId" of the app, for example `553834731` for Candy Crush Saga.
* `country`: the two letter country code to get the privacy disclosures from. Defaults to `us`.

Example:

```js
import store from 'app-store-scraper';

store.privacy({
  id: 324684580,
})
.then(console.log)
.catch(console.log);
```

Returns:

```js
{
  "managePrivacyChoicesUrl": null,
  "privacyTypes": [
    {
      "privacyType": "Data Used to Track You",
      "identifier": "DATA_USED_TO_TRACK_YOU",
      "description": "The following data may be used to track you across apps and websites owned by other companies:",
      "dataCategories": [
        {
          "dataCategory": "Contact Info",
          "identifier": "CONTACT_INFO",
          "dataTypes": [
            "Email Address",
            "Phone Number"
          ]
        },
        ...
      ],
      "purposes": []
    },
    ...
  ]
}
```

### suggest

Retrieves the suggestions currently returned by the App Store for a partial
search term. Each result contains a `term` string. Options:

* `term`: the required partial search term.
* `country`: the two letter country code to get suggestions from. Defaults to `us`.

Example:

```js
import store from 'app-store-scraper';

store.suggest({term: 'panda'}).then(console.log).catch(console.log);
```

Results:

```js
[
  { term: 'panda pop' },
  { term: 'panda pop free' },
  { term: 'panda' },
  { term: 'panda express' },
  { term: 'panda games' },
  { term: 'panda pop 2' },
  ...
]
```

### similar
Returns the list of "customers also bought" apps shown in the app's detail page. Options:

* `id`: the iTunes "trackId" of the app, for example `553834731` for Candy Crush Saga. Either this or the `appId` should be provided.
* `appId`: the iTunes "bundleId" of the app, for example `com.midasplayer.apps.candycrushsaga` for Candy Crush Saga. Either this or the `id` should be provided.
* `country`: the two letter country code to get similar apps from. Defaults to `us`.
* `lang`: language code for the returned app details. Defaults to undefined, so country specific language should be used automatically.

Example:

```js
import store from 'app-store-scraper';

store.similar({id: 553834731}).then(console.log).catch(console.log);
```

Results:

```js
[
  {
    id: 632285588,
    appId: 'com.nerdyoctopus.dots',
    title: 'Dots: A Game About Connecting',
    (...)
  },
  {
    id: 727296976,
    appId: 'com.sgn.cookiejam',
    title: 'Cookie Jam',
    (...)
  }
  (...)
]
```

### reviews

Retrieves a page of reviews for the app. Options:

* `id`: the iTunes "trackId" of the app, for example `553834731` for Candy Crush Saga. Either this or the `appId` should be provided.
* `appId`: the iTunes "bundleId" of the app, for example `com.midasplayer.apps.candycrushsaga` for Candy Crush Saga. Either this or the `id` should be provided.
* `country`: the two letter country code to get the reviews from. Defaults to `us`.
* `page`: the review page number to retrieve. Defaults to `1`, maximum allowed is `10`.
* `sort`: the review sort order. Defaults to `store.sort.RECENT`, available options are `store.sort.RECENT` and `store.sort.HELPFUL`.

Example:

```js
import store from 'app-store-scraper';

store.reviews({
  appId: 'com.midasplayer.apps.candycrushsaga',
  sort: store.sort.HELPFUL,
  page: 2
})
.then(console.log)
.catch(console.log);
```

Returns:

```js
[ { id: '1472864600',
    userName: 'Linda D. Lopez',
    userUrl: 'https://itunes.apple.com/us/reviews/id324568166',
    version: '1.80.1',
    score: 5,
    title: 'Great way to pass time or unwind',
    text: 'I was a fan of Bejeweled many moons ago...',
    updated: '2021-07-26T18:26:24-07:00',
    url: 'https://itunes.apple.com/us/review?id=553834731&type=Purple%20Software' },
  { id: '1472864708',
    userName: 'Jennamaxkidd',
    userUrl: 'https://itunes.apple.com/us/reviews/id223990784',
    version: '1.80.1',
    score: 1,
    title: 'Help! THE PROBLEM IS NOT FIXED!',
    text: 'STILL HAVING THE SAME ISSUE.  It\'s happening again...',
    updated: '2021-07-26T18:04:41-07:00',
    url: 'https://itunes.apple.com/us/review?id=553834731&type=Purple%20Software' },
  (...)
]
```

### ratings

Retrieves the country-specific rating count and star histogram for the app.
Apple may abbreviate large displayed counts, so totals parsed from values such
as `3.9M` are approximate.

Options:

* `id`: the required numeric iTunes "trackId", for example `553834731` for Candy Crush Saga.
* `country`: a supported two-letter App Store country code. Defaults to `us`.

Example:

```js
import store from 'app-store-scraper';

store.ratings({
  id: 553834731,
  country: 'fr'
})
.then(console.log)
.catch(console.log);
```

Returns:

```js
{
  ratings: 652719,
  histogram: {
    '1': 7012,
    '2': 6655,
    '3': 26876,
    '4': 140680,
    '5': 471496
  }
}
```

### versionHistory

Retrieves the version history for the app. Options:

* `id`: the required iTunes "trackId" of the app, for example `553834731` for Candy Crush Saga.
* `country`: the two letter country code to get the version history from. Defaults to `us`.

Example:

```js
import store from 'app-store-scraper';

store.versionHistory({
  id: 324684580,
})
.then(console.log)
.catch(console.log);
```

Returns:

```js
[
  {
    "versionDisplay": "3.416.0",
    "releaseNotes": "• Minor UI enhancements and bug fixes",
    "releaseDate": "2024-08-14",
    "releaseTimestamp": "2024-08-14T14:52:32Z"
  }
]
```

### Memoization

Since every library call performs one or multiple requests to
an iTunes API or web page, sometimes it can be useful to cache the results
to avoid requesting the same data twice. The `memoized` function returns the
store object that caches its results:

``` javascript
import store, { memoized as createMemoized } from 'app-store-scraper'; // regular non caching version

const memoized = createMemoized(); // cache with default options
const memoizedCustom = createMemoized({ maxAge: 1000 * 60 }); // cache with custom options

memoized.app({id: 553834731}) // will make a request
  .then(() => memoized.app({id: 553834731})); // will resolve to the cached value without requesting
```

The options available are those supported by the [memoizee](https://github.com/medikoo/memoizee) module.
By default up to 1000 values are cached by each method and they expire after 5 minutes.

### Request options

Scraper methods accept a `requestOptions` object for advanced HTTP configuration.
The options are passed to Node.js [`http.request`](https://nodejs.org/api/http.html#httprequestoptions-callback).
Options specific to the deprecated `request` package are no longer supported.

Requests time out after 10 seconds and retry transient GET failures up to two times by default.
Use `timeout`, `retries`, `retryDelay`, and `maxRetryDelay` in `requestOptions` to override these defaults.

Methods that perform lookup requests also accept a positive integer `throttle` option.
Calls with the same value share a requests-per-second queue; different values use isolated queues.
