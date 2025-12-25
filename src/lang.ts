import { mainLangs } from "./langs";

/**
 * Define extra languages.
 *
 * @returns A dictionary of extra languages manually defined.
 *
 * Variations of the ones generated in `mainLangs`,
 * observed to provide different dialects or accents or
 * just simply accepted by the Google Translate Text-to-Speech API.
 */
function extraLangs(): Record<string, string> {
  return {
    // Chinese
    "zh-TW": "Chinese (Mandarin/Taiwan)",
    "zh": "Chinese (Mandarin)",
  };
}

/**
 * Languages Google Text-to-Speech supports.
 *
 * @returns A dictionary of the type `{ '<lang>': '<name>'}`
 *
 * Where `<lang>` is an IETF language tag such as `en` or `zh-TW`,
 * and `<name>` is the full English name of the language, such as
 * `English` or `Chinese (Mandarin/Taiwan)`.
 *
 * The dictionary returned combines languages from two origins:
 *
 * - Languages fetched from Google Translate (pre-generated in `langs`)
 * - Languages that are undocumented variations that were observed to work and
 *   present different dialects or accents.
 */
export function ttsLangs(): Record<string, string> {
  const langs = { ...mainLangs(), ...extraLangs() };
  // log.debug("langs: {}".format(langs)) // Logging skipped for now or use console.debug
  return langs;
}

/**
 * Languages Google Text-to-Speech used to support.
 *
 * Language tags that don't work anymore, but that can
 * fallback to a more general language code to maintain
 * compatibility.
 *
 * @param lang - The language tag.
 * @returns The language tag, as-is if not deprecated,
 * or a fallback if it exits.
 *
 * @example
 * `en-GB` returns `en`.
 * `en-gb` returns `en`.
 */
export function fallbackDeprecatedLang(lang: string): string {
  const deprecated: Record<string, string[]> = {
    // '<fallback>': [<list of deprecated langs>]
    "en": [
      "en-us",
      "en-ca",
      "en-uk",
      "en-gb",
      "en-au",
      "en-gh",
      "en-in",
      "en-ie",
      "en-nz",
      "en-ng",
      "en-ph",
      "en-za",
      "en-tz",
    ],
    "fr": ["fr-fr"],
    "pt": ["pt-br", "pt-pt"],
    "es": ["es-es", "es-us"],
    "zh-CN": ["zh-cn"],
    "zh-TW": ["zh-tw"],
  };

  for (const [fallbackLang, deprecatedLangs] of Object.entries(deprecated)) {
    if (deprecatedLangs.includes(lang.toLowerCase())) {
      const msg = `'${lang}' has been deprecated, falling back to '${fallbackLang}'. This fallback will be removed in a future version.`;
      console.warn(msg);
      return fallbackLang;
    }
  }

  return lang;
}
