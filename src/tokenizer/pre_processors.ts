import { PreProcessorRegex, PreProcessorSub } from "./core";
import { TONE_MARKS, ABBREVIATIONS, SUB_PAIRS } from "./symbols";

/**
 * Add a space after tone-modifying punctuation.
 *
 * Because the `tone_marks` tokenizer case will split after a tone-modifying
 * punctuation mark, make sure there's whitespace after.
 */
export function toneMarks(text: string): string {
  // Python: u"(?<={})".format(x) -> Lookbehind
  // JS supports lookbehind in recent versions (ECMAScript 2018).
  return new PreProcessorRegex(
    TONE_MARKS.split(""),
    (x) => `(?<=${x})`,
    " "
  ).run(text);
}

/**
 * Re-form words cut by end-of-line hyphens.
 *
 * Remove "<hyphen><newline>".
 */
export function endOfLine(text: string): string {
  return new PreProcessorRegex(
    "-",
    (x) => `${x}\\n`,
    ""
  ).run(text);
}

/**
 * Remove periods after an abbreviation from a list of known
 * abbreviations that can be spoken the same without that period. This
 * prevents having to handle tokenization of that period.
 */
export function abbreviations(text: string): string {
  return new PreProcessorRegex(
    ABBREVIATIONS,
    // Python: r"(?<={})(?=\.).".format(x)
    // Positive lookbehind for abbreviation, positive lookahead for period, match the period.
    // In JS regex: (?<=abbr)(?=\.).
    // But . in regex matches any char, so we need literal dot.
    // Python code was `r"(?<={})(?=\.)."` where `.` matches the period we want to remove?
    // Wait, `.` matches any char except newline.
    // Let's re-read Python code: `lambda x: r"(?<={})(?=\.).".format(x)`
    // If x="dr", regex is `(?<=dr)(?=\.).`
    // This matches a character preceded by "dr" and followed by ".".
    // Wait, no. `(?=\.)` checks if next char is `.`.
    // Then `.` matches that char.
    // So it matches the period itself.
    (x) => `(?<=${x})(?=\\.).`,
    "",
    "i" // ignore case
  ).run(text);
}

/**
 * Word-for-word substitutions.
 */
export function wordSub(text: string): string {
  return new PreProcessorSub(SUB_PAIRS).run(text);
}
