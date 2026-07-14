// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import extractCashtagsWithIndices from './extractCashtagsWithIndices.js';
import extractHashtagsWithIndices from './extractHashtagsWithIndices.js';
import extractMentionsOrListsWithIndices from './extractMentionsOrListsWithIndices.js';
import extractUrlsWithIndices from './extractUrlsWithIndices.js';
import removeOverlappingEntities from './removeOverlappingEntities.js';
export default function (text, options) {
  var entities = extractUrlsWithIndices(text, options).concat(extractMentionsOrListsWithIndices(text)).concat(extractHashtagsWithIndices(text, {
    checkUrlOverlap: false
  })).concat(extractCashtagsWithIndices(text));

  if (entities.length == 0) {
    return [];
  }

  removeOverlappingEntities(entities);
  return entities;
}