// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlDomainSegment from './validateUrlDomainSegment.js';
import validateUrlDomainTld from './validateUrlDomainTld.js';
import validateUrlSubDomainSegment from './validateUrlSubDomainSegment.js';
var validateUrlDomain = regexSupplant(/(?:(?:#{validateUrlSubDomainSegment}\.)*(?:#{validateUrlDomainSegment}\.)#{validateUrlDomainTld})/i, {
  validateUrlSubDomainSegment: validateUrlSubDomainSegment,
  validateUrlDomainSegment: validateUrlDomainSegment,
  validateUrlDomainTld: validateUrlDomainTld
});
export default validateUrlDomain;