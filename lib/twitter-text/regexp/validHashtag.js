// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import hashSigns from './hashSigns.js';
import hashtagAlpha from './hashtagAlpha.js';
import hashtagAlphaNumeric from './hashtagAlphaNumeric.js';
import hashtagBoundary from './hashtagBoundary.js';
import regexSupplant from '../lib/regexSupplant.js';
var validHashtag = regexSupplant(/(#{hashtagBoundary})(#{hashSigns})(?!\uFE0F|\u20E3)(#{hashtagAlphaNumeric}*#{hashtagAlpha}#{hashtagAlphaNumeric}*)/gi, {
  hashtagBoundary: hashtagBoundary,
  hashSigns: hashSigns,
  hashtagAlphaNumeric: hashtagAlphaNumeric,
  hashtagAlpha: hashtagAlpha
});
export default validHashtag;