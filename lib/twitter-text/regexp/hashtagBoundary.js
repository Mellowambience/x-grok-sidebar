// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import codePoint from './codePoint.js';
import hashtagAlphaNumeric from './hashtagAlphaNumeric.js';
import regexSupplant from '../lib/regexSupplant.js';
var hashtagBoundary = regexSupplant(/(?:^|\uFE0E|\uFE0F|$|(?!#{hashtagAlphaNumeric}|&)#{codePoint})/, {
  codePoint: codePoint,
  hashtagAlphaNumeric: hashtagAlphaNumeric
});
export default hashtagBoundary;