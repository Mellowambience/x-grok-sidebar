// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validCCTLD from './validCCTLD.js';
import validDomainName from './validDomainName.js';
import validGTLD from './validGTLD.js';
import validPunycode from './validPunycode.js';
import validSubdomain from './validSubdomain.js';
var validDomain = regexSupplant(/(?:#{validSubdomain}*#{validDomainName}(?:#{validGTLD}|#{validCCTLD}|#{validPunycode}))/, {
  validDomainName: validDomainName,
  validSubdomain: validSubdomain,
  validGTLD: validGTLD,
  validCCTLD: validCCTLD,
  validPunycode: validPunycode
});
export default validDomain;