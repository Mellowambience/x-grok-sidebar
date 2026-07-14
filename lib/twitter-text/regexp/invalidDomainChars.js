// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import directionalMarkersGroup from './directionalMarkersGroup.js';
import invalidCharsGroup from './invalidCharsGroup.js';
import punct from './punct.js';
import spacesGroup from './spacesGroup.js';
import stringSupplant from '../lib/stringSupplant.js';
var invalidDomainChars = stringSupplant('#{punct}#{spacesGroup}#{invalidCharsGroup}#{directionalMarkersGroup}', {
  punct: punct,
  spacesGroup: spacesGroup,
  invalidCharsGroup: invalidCharsGroup,
  directionalMarkersGroup: directionalMarkersGroup
});
export default invalidDomainChars;