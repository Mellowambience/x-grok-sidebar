// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import configs from './configs.js';
import extractUrlsWithIndices from './extractUrlsWithIndices.js';
import getCharacterWeight from './lib/getCharacterWeight.js';
import modifyIndicesFromUTF16ToUnicode from './modifyIndicesFromUTF16ToUnicode.js';
import nonBmpCodePairs from './regexp/nonBmpCodePairs.js';
import parseTweet from './parseTweet.js';
import urlHasHttps from './regexp/urlHasHttps.js';

var getTweetLength = function getTweetLength(text) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : configs.defaults;
  return parseTweet(text, options).weightedLength;
};

export default getTweetLength;