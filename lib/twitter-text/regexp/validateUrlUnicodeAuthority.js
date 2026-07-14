// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlUserinfo from './validateUrlUserinfo.js';
import validateUrlUnicodeHost from './validateUrlUnicodeHost.js';
import validateUrlPort from './validateUrlPort.js';
var validateUrlUnicodeAuthority = regexSupplant( // $1 userinfo
'(?:(#{validateUrlUserinfo})@)?' + // $2 host
'(#{validateUrlUnicodeHost})' + // $3 port
'(?::(#{validateUrlPort}))?', {
  validateUrlUserinfo: validateUrlUserinfo,
  validateUrlUnicodeHost: validateUrlUnicodeHost,
  validateUrlPort: validateUrlPort
}, 'i');
export default validateUrlUnicodeAuthority;