// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlUnreserved from './validateUrlUnreserved.js';
import validateUrlPctEncoded from './validateUrlPctEncoded.js';
import validateUrlSubDelims from './validateUrlSubDelims.js'; // These URL validation pattern strings are based on the ABNF from RFC 3986

var validateUrlPchar = regexSupplant('(?:' + '#{validateUrlUnreserved}|' + '#{validateUrlPctEncoded}|' + '#{validateUrlSubDelims}|' + '[:|@]' + ')', {
  validateUrlUnreserved: validateUrlUnreserved,
  validateUrlPctEncoded: validateUrlPctEncoded,
  validateUrlSubDelims: validateUrlSubDelims
}, 'i');
export default validateUrlPchar;