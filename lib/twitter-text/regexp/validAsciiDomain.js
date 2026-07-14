// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import latinAccentChars from './latinAccentChars.js';
import regexSupplant from '../lib/regexSupplant.js';
import validCCTLD from './validCCTLD.js';
import validGTLD from './validGTLD.js';
import validPunycode from './validPunycode.js';
var validAsciiDomain = regexSupplant(/(?:(?:[\-a-z0-9#{latinAccentChars}]+)\.)+(?:#{validGTLD}|#{validCCTLD}|#{validPunycode})/gi, {
  latinAccentChars: latinAccentChars,
  validGTLD: validGTLD,
  validCCTLD: validCCTLD,
  validPunycode: validPunycode
});
export default validAsciiDomain;