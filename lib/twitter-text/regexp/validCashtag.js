// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import cashtag from './cashtag.js';
import punct from './punct.js';
import regexSupplant from '../lib/regexSupplant.js';
import spaces from './spaces.js';
var validCashtag = regexSupplant('(^|#{spaces})(\\$)(#{cashtag})(?=$|\\s|[#{punct}])', {
  cashtag: cashtag,
  spaces: spaces,
  punct: punct
}, 'gi');
export default validCashtag;