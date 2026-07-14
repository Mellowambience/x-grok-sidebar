// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import htmlEscape from './htmlEscape.js';
var BOOLEAN_ATTRIBUTES = {
  disabled: true,
  readonly: true,
  multiple: true,
  checked: true
};
export default function (attributes) {
  var htmlAttrs = '';

  for (var k in attributes) {
    var v = attributes[k];

    if (BOOLEAN_ATTRIBUTES[k]) {
      v = v ? k : null;
    }

    if (v == null) {
      continue;
    }

    htmlAttrs += " ".concat(htmlEscape(k), "=\"").concat(htmlEscape(v.toString()), "\"");
  }

  return htmlAttrs;
}