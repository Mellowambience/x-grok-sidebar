// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import astralLetterAndMarks from './astralLetterAndMarks.js';
import astralNumerals from './astralNumerals.js';
import bmpLetterAndMarks from './bmpLetterAndMarks.js';
import bmpNumerals from './bmpNumerals.js';
import hashtagSpecialChars from './hashtagSpecialChars.js';
import nonBmpCodePairs from './nonBmpCodePairs.js';
import regexSupplant from '../lib/regexSupplant.js';
var hashtagAlphaNumeric = regexSupplant(/(?:[#{bmpLetterAndMarks}#{bmpNumerals}#{hashtagSpecialChars}]|(?=#{nonBmpCodePairs})(?:#{astralLetterAndMarks}|#{astralNumerals}))/, {
  bmpLetterAndMarks: bmpLetterAndMarks,
  bmpNumerals: bmpNumerals,
  hashtagSpecialChars: hashtagSpecialChars,
  nonBmpCodePairs: nonBmpCodePairs,
  astralLetterAndMarks: astralLetterAndMarks,
  astralNumerals: astralNumerals
});
export default hashtagAlphaNumeric;