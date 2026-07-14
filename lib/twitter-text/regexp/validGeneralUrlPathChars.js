// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import cyrillicLettersAndMarks from './cyrillicLettersAndMarks.js';
import latinAccentChars from './latinAccentChars.js';
import regexSupplant from '../lib/regexSupplant.js';
var validGeneralUrlPathChars = regexSupplant(/[a-z#{cyrillicLettersAndMarks}0-9!\*';:=\+,\.\$\/%#\[\]\-\u2013_~@\|&#{latinAccentChars}]/i, {
  cyrillicLettersAndMarks: cyrillicLettersAndMarks,
  latinAccentChars: latinAccentChars
});
export default validGeneralUrlPathChars;