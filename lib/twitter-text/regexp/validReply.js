// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import atSigns from './atSigns.js';
import regexSupplant from '../lib/regexSupplant.js';
import spaces from './spaces.js';
var validReply = regexSupplant(/^(?:#{spaces})*#{atSigns}([a-zA-Z0-9_]{1,20})/, {
  atSigns: atSigns,
  spaces: spaces
});
export default validReply;