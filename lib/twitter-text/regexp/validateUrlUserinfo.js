// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlUnreserved from './validateUrlUnreserved.js';
import validateUrlPctEncoded from './validateUrlPctEncoded.js';
import validateUrlSubDelims from './validateUrlSubDelims.js';
var validateUrlUserinfo = regexSupplant('(?:' + '#{validateUrlUnreserved}|' + '#{validateUrlPctEncoded}|' + '#{validateUrlSubDelims}|' + ':' + ')*', {
  validateUrlUnreserved: validateUrlUnreserved,
  validateUrlPctEncoded: validateUrlPctEncoded,
  validateUrlSubDelims: validateUrlSubDelims
}, 'i');
export default validateUrlUserinfo;