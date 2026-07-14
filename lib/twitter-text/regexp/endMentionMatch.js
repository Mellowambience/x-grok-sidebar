// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import atSigns from './atSigns.js';
import latinAccentChars from './latinAccentChars.js';
import regexSupplant from '../lib/regexSupplant.js';
var endMentionMatch = regexSupplant(/^(?:#{atSigns}|[#{latinAccentChars}]|:\/\/)/, {
  atSigns: atSigns,
  latinAccentChars: latinAccentChars
});
export default endMentionMatch;