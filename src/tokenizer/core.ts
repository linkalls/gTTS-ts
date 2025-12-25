// Note: In TS, RegEx is a built-in object. Python's `re.escape` equivalent is needed.
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * Builds regex using arguments passed into a pattern template.
 *
 * Builds a regex object for which the pattern is made from an argument
 * passed into a template. If more than one argument is passed (iterable),
 * each pattern is joined by "|" (regex alternation 'or') to create a
 * single pattern.
 */
export class RegexBuilder {
  public regex: RegExp;

  /**
   * @param patternArgs - String element(s) to be each passed to
   * `patternFunc` to create a regex pattern. Each element is
   * escaped before being passed.
   * @param patternFunc - A 'template' function that should take a
   * string and return a string. It should take an element of
   * `patternArgs` and return a valid regex pattern group string.
   * @param flags - `RegExp` flag(s) to compile with the regex.
   */
  constructor(
    private patternArgs: string | string[],
    private patternFunc: (x: string) => string,
    private flags: string = ""
  ) {
    this.regex = this.compile();
  }

  private compile(): RegExp {
    const args = Array.isArray(this.patternArgs) ? this.patternArgs : [this.patternArgs];
    const alts: string[] = [];
    for (let arg of args) {
      arg = escapeRegExp(arg);
      const alt = this.patternFunc(arg);
      alts.push(alt);
    }
    const pattern = alts.join("|");
    return new RegExp(pattern, this.flags);
  }
}

/**
 * Regex-based substitution text pre-processor.
 *
 * Runs a series of regex substitutions (`String.prototype.replace`) from each `regex` of a
 * `RegexBuilder` with an extra `repl` replacement parameter.
 */
export class PreProcessorRegex {
  private regexes: RegExp[] = [];

  /**
   * @param searchArgs - String element(s) to be each passed to
   * `searchFunc` to create a regex pattern. Each element is
   * escaped before being passed.
   * @param searchFunc - A 'template' function that should take a
   * string and return a string. It should take an element of
   * `searchArgs` and return a valid regex search pattern string.
   * @param repl - The common replacement passed to the `replace` method for
   * each `regex`.
   * @param flags - `RegExp` flag(s) to compile with each `regex`.
   */
  constructor(
    searchArgs: string | string[],
    searchFunc: (x: string) => string,
    private repl: string,
    flags: string = ""
  ) {
    const args = Array.isArray(searchArgs) ? searchArgs : [searchArgs];
    for (const arg of args) {
      const rb = new RegexBuilder([arg], searchFunc, flags);
      this.regexes.push(rb.regex);
    }
  }

  /**
   * Run each regex substitution on `text`.
   *
   * @param text - the input text.
   * @returns text after all substitutions have been sequentially applied.
   */
  public run(text: string): string {
    // In JS replace only replaces the first occurrence unless global flag is set.
    // Python's re.sub replaces all occurrences.
    // So we should probably ensure the 'g' flag is present if we want global replacement.
    // However, the Python code allows passing flags.
    // If the user passes flags without 'g', JS won't replace all.
    // But let's stick to the structure.
    for (const regex of this.regexes) {
       // Check if global flag is needed to match Python behavior (re.sub)
       // re.sub replaces all non-overlapping occurrences.
       // So we should enforce global flag if it's not present?
       // Let's assume the flags passed in include 'g' if needed, OR we should force it.
       // Python's re.sub is global by default.
       let flags = regex.flags;
       if (!flags.includes('g')) {
           flags += 'g';
       }
       const globalRegex = new RegExp(regex.source, flags);
       text = text.replace(globalRegex, this.repl);
    }
    return text;
  }
}

/**
 * Simple substitution text preprocessor.
 *
 * Performs string-for-string substitution from list a find/replace pairs.
 * It abstracts `PreProcessorRegex` with a default simple substitution regex.
 */
export class PreProcessorSub {
  private preProcessors: PreProcessorRegex[] = [];

  /**
   * @param subPairs - A list of tuples of the style `[<search str>, <replace str>]`
   * @param ignoreCase - Ignore case during search. Defaults to `true`.
   */
  constructor(subPairs: [string, string][], ignoreCase: boolean = true) {
    const searchFunc = (x: string) => `${x}`;
    const flags = ignoreCase ? "i" : "";

    for (const [pattern, repl] of subPairs) {
      const pp = new PreProcessorRegex([pattern], searchFunc, repl, flags);
      this.preProcessors.push(pp);
    }
  }

  /**
   * Run each substitution on `text`.
   *
   * @param text - the input text.
   * @returns text after all substitutions have been sequentially applied.
   */
  public run(text: string): string {
    for (const pp of this.preProcessors) {
      text = pp.run(text);
    }
    return text;
  }
}

/**
 * An extensible but simple generic rule-based tokenizer.
 *
 * A generic and simple string tokenizer that takes a list of functions
 * (called `tokenizer cases`) returning `regex` objects and joins them by
 * "|" (regex alternation 'or') to create a single regex to use with the
 * standard `String.prototype.split()` function.
 */
export class Tokenizer {
  private totalRegex: RegExp;

  /**
   * @param regexFuncs - List of compiled `regex` objects (functions returning them).
   * Each function's pattern will be joined into a single pattern and compiled.
   * @param flags - `RegExp` flag(s) to compile with the final regex. Defaults to
   * `i` (ignore case).
   */
  constructor(
    private regexFuncs: (() => RegExp)[],
    private flags: string = "i"
  ) {
    this.totalRegex = this.combineRegex();
  }

  private combineRegex(): RegExp {
    const alts: RegExp[] = [];
    for (const func of this.regexFuncs) {
      alts.push(func());
    }

    // In JS, split keeps separators if they are captured.
    // The python code just joins patterns.
    // If we want to split AND keep the tokens, we usually wrap the pattern in ().
    // Python's re.split behavior: "If capturing parentheses are used in pattern, then the text of all groups in the pattern are also returned as part of the resulting list."
    // gTTS relies on this to keep the delimiters as tokens.
    // So we need to ensure capturing groups.
    const patterns = alts.map(alt => {
        // We need to ensure the pattern is captured.
        // If it's already captured, good.
        // But simply wrapping in () might create nested groups.
        return `(${alt.source})`;
    });

    const pattern = patterns.join("|");
    return new RegExp(pattern, this.flags);
  }

  /**
   * Tokenize `text`.
   *
   * @param text - the input text to tokenize.
   * @returns A list of strings (token) split according to the tokenizer cases.
   */
  public run(text: string): string[] {
    return text.split(this.totalRegex);
  }
}
