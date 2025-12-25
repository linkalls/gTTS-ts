import { ALL_PUNC } from "./tokenizer/symbols";

const _ALL_PUNC_OR_SPACE = new RegExp(`^[${ALL_PUNC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s]*$`);

/**
 * Recursively split a string in the largest chunks
 * possible from the highest position of a delimiter all the way
 * to a maximum size
 *
 * @param theString - The string to split.
 * @param delim - The delimiter to split on.
 * @param maxSize - The maximum size of a chunk.
 * @returns The minimized string in tokens
 */
export function minimize(theString: string, delim: string, maxSize: number): string[] {
  // Remove `delim` from start of `theString`
  // i.e. prevent a recursive infinite loop on `theString[0:0]`
  // if `theString` starts with `delim` and is larger than `maxSize`
  if (theString.startsWith(delim)) {
    theString = theString.substring(delim.length);
  }

  if (theString.length > maxSize) {
    let idx: number;
    try {
      // Find the highest index of `delim` in `theString[0:maxSize]`
      // i.e. `theString` will be cut in half on `delim` index
      idx = theString.lastIndexOf(delim, maxSize);
      if (idx === -1) {
          throw new Error("Value not found");
      }
    } catch (e) {
      // `delim` not found in `theString`, index becomes `maxSize`
      // i.e. `theString` will be cut in half arbitrarily on `maxSize`
      idx = maxSize;
    }
    // Call itself again for `theString[idx:]`
    return [theString.substring(0, idx), ...minimize(theString.substring(idx), delim, maxSize)];
  } else {
    return [theString];
  }
}

/**
 * Clean a list of strings
 *
 * @param tokens - A list of strings (tokens) to clean.
 * @returns Stripped strings `tokens` without the original elements
 * that only consisted of whitespace and/or punctuation characters.
 */
export function cleanTokens(tokens: string[]): string[] {
  return tokens
    .map(t => t.trim())
    .filter(t => t && !_ALL_PUNC_OR_SPACE.test(t));
}

/**
 * Generates a Google Translate URL
 *
 * @param tld - Top-level domain for the Google Translate host,
 * i.e `https://translate.google.<tld>`. Default is `com`.
 * @param path - A path to append to the Google Translate host,
 * i.e `https://translate.google.com/<path>`. Default is `""`.
 * @returns A Google Translate URL `https://translate.google.<tld>/path`
 */
export function translateUrl(tld: string = "com", path: string = ""): string {
  return `https://translate.google.${tld}/${path}`;
}
