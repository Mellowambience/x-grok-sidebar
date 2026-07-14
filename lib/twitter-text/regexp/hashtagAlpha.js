// Copyright 2018 Twitter, Inc.
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0
import astralLetterAndMarks from './astralLetterAndMarks.js';
import bmpLetterAndMarks from './bmpLetterAndMarks.js';
import nonBmpCodePairs from './nonBmpCodePairs.js';
import regexSupplant from '../lib/regexSupplant.js'; // A hashtag must contain at least one unicode letter or mark, as well as numbers, underscores, and select special characters.

var hashtagAlpha = regexSupplant(/(?:[#{bmpLetterAndMarks}]|(?=#{nonBmpCodePairs})(?:#{astralLetterAndMarks}))/, {
  bmpLetterAndMarks: bmpLetterAndMarks,
  nonBmpCodePairs: nonBmpCodePairs,
  astralLetterAndMarks: astralLetterAndMarks
});
export default hashtagAlpha;