// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import directionalMarkersGroup from './directionalMarkersGroup.js';
import invalidCharsGroup from './invalidCharsGroup.js';
import regexSupplant from '../lib/regexSupplant.js';
var validUrlPrecedingChars = regexSupplant(/(?:[^A-Za-z0-9@＠$#＃#{invalidCharsGroup}]|[#{directionalMarkersGroup}]|^)/, {
  invalidCharsGroup: invalidCharsGroup,
  directionalMarkersGroup: directionalMarkersGroup
});
export default validUrlPrecedingChars;