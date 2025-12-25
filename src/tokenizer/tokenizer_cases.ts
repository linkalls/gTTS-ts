import { RegexBuilder } from "./core";
import { TONE_MARKS, PERIOD_COMMA, COLON, ALL_PUNC } from "./symbols";

/**
 * Keep tone-modifying punctuation by matching following character.
 *
 * Assumes the `tone_marks` pre-processor was run for cases where there might
 * not be any space after a tone-modifying punctuation mark.
 */
export function toneMarks(): RegExp {
  return new RegexBuilder(
    TONE_MARKS.split(""),
    (x) => `(?<=${x}).`
  ).regex;
}

/**
 * Period and comma case.
 *
 * Match if not preceded by ".<letter>" and only if followed by space.
 * Won't cut in the middle/after dotted abbreviations; won't cut numbers.
 */
export function periodComma(): RegExp {
  return new RegexBuilder(
    PERIOD_COMMA.split(""),
    // Python: r"(?<!\.[a-z]){} ".format(x)
    // Negative lookbehind `(?<!\.[a-z])`
    (x) => `(?<!\\.[a-z])${x} `
  ).regex;
}

/**
 * Colon case.
 *
 * Match a colon ":" only if not preceded by a digit.
 * Mainly to prevent a cut in the middle of time notations e.g. 10:01
 */
export function colon(): RegExp {
  return new RegexBuilder(
    COLON.split(""),
    // Python: r"(?<!\d){}".format(x)
    (x) => `(?<!\\d)${x}`
  ).regex;
}

/**
 * Match other punctuation.
 *
 * Match other punctuation to split on; punctuation that naturally
 * inserts a break in speech.
 */
export function otherPunctuation(): RegExp {
  const puncSet = new Set(ALL_PUNC.split(""));
  const toneMarksSet = new Set(TONE_MARKS.split(""));
  const periodCommaSet = new Set(PERIOD_COMMA.split(""));
  const colonSet = new Set(COLON.split(""));

  const punc = [...puncSet].filter(x =>
    !toneMarksSet.has(x) &&
    !periodCommaSet.has(x) &&
    !colonSet.has(x)
  );

  return new RegexBuilder(
    punc,
    (x) => `${x}`
  ).regex;
}
