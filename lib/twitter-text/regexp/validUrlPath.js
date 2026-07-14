// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validGeneralUrlPathChars from './validGeneralUrlPathChars.js';
import validUrlBalancedParens from './validUrlBalancedParens.js';
import validUrlPathEndingChars from './validUrlPathEndingChars.js'; // Allow @ in a url, but only in the middle. Catch things like http://example.com/@user/

var validUrlPath = regexSupplant('(?:' + '(?:' + '#{validGeneralUrlPathChars}*' + '(?:#{validUrlBalancedParens}#{validGeneralUrlPathChars}*)*' + '#{validUrlPathEndingChars}' + ')|(?:@#{validGeneralUrlPathChars}+/)' + ')', {
  validGeneralUrlPathChars: validGeneralUrlPathChars,
  validUrlBalancedParens: validUrlBalancedParens,
  validUrlPathEndingChars: validUrlPathEndingChars
}, 'i');
export default validUrlPath;