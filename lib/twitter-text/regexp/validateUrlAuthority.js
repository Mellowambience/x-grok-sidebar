// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import regexSupplant from '../lib/regexSupplant.js';
import validateUrlUserinfo from './validateUrlUserinfo.js';
import validateUrlHost from './validateUrlHost.js';
import validateUrlPort from './validateUrlPort.js';
var validateUrlAuthority = regexSupplant( // $1 userinfo
'(?:(#{validateUrlUserinfo})@)?' + // $2 host
'(#{validateUrlHost})' + // $3 port
'(?::(#{validateUrlPort}))?', {
  validateUrlUserinfo: validateUrlUserinfo,
  validateUrlHost: validateUrlHost,
  validateUrlPort: validateUrlPort
}, 'i');
export default validateUrlAuthority;