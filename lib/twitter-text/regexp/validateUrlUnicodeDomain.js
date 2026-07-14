// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlUnicodeSubDomainSegment from './validateUrlUnicodeSubDomainSegment.js';
import validateUrlUnicodeDomainSegment from './validateUrlUnicodeDomainSegment.js';
import validateUrlUnicodeDomainTld from './validateUrlUnicodeDomainTld.js'; // Unencoded internationalized domains - this doesn't check for invalid UTF-8 sequences

var validateUrlUnicodeDomain = regexSupplant(/(?:(?:#{validateUrlUnicodeSubDomainSegment}\.)*(?:#{validateUrlUnicodeDomainSegment}\.)#{validateUrlUnicodeDomainTld})/i, {
  validateUrlUnicodeSubDomainSegment: validateUrlUnicodeSubDomainSegment,
  validateUrlUnicodeDomainSegment: validateUrlUnicodeDomainSegment,
  validateUrlUnicodeDomainTld: validateUrlUnicodeDomainTld
});
export default validateUrlUnicodeDomain;