// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import cyrillicLettersAndMarks from './cyrillicLettersAndMarks.js';
import latinAccentChars from './latinAccentChars.js';
import regexSupplant from '../lib/regexSupplant.js';
import validUrlBalancedParens from './validUrlBalancedParens.js'; // Valid end-of-path chracters (so /foo. does not gobble the period).
// 1. Allow =&# for empty URL parameters and other URL-join artifacts

var validUrlPathEndingChars = regexSupplant(/[\+\-a-z#{cyrillicLettersAndMarks}0-9=_#\/#{latinAccentChars}]|(?:#{validUrlBalancedParens})/i, {
  cyrillicLettersAndMarks: cyrillicLettersAndMarks,
  latinAccentChars: latinAccentChars,
  validUrlBalancedParens: validUrlBalancedParens
});
export default validUrlPathEndingChars;