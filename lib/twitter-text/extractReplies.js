// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import endMentionMatch from './regexp/endMentionMatch.js';
import validReply from './regexp/validReply.js';
export default function (text) {
  if (!text) {
    return null;
  }

  var possibleScreenName = text.match(validReply);

  if (!possibleScreenName || RegExp.rightContext.match(endMentionMatch)) {
    return null;
  }

  return possibleScreenName[1];
}