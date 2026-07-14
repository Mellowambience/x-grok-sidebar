// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlPchar from './validateUrlPchar.js';
var validateUrlQuery = regexSupplant(/(#{validateUrlPchar}|\/|\?)*/i, {
  validateUrlPchar: validateUrlPchar
});
export default validateUrlQuery;