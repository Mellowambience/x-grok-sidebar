// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import clone from './lib/clone.js';
import htmlEscape from './htmlEscape.js';
import linkToTextWithSymbol from './linkToTextWithSymbol.js';
export default function (entity, text, options) {
  var cashtag = htmlEscape(entity.cashtag);
  var attrs = clone(options.htmlAttrs || {});
  attrs.href = options.cashtagUrlBase + cashtag;
  attrs.title = "$".concat(cashtag);
  attrs['class'] = options.cashtagClass;

  if (options.targetBlank) {
    attrs.target = '_blank';
  }

  return linkToTextWithSymbol(entity, '$', cashtag, attrs, options);
}