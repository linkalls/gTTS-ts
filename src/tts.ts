import { fallbackDeprecatedLang, ttsLangs } from "./lang";
import { Tokenizer } from "./tokenizer/core";
import * as preProcessors from "./tokenizer/pre_processors";
import * as tokenizerCases from "./tokenizer/tokenizer_cases";
import { cleanTokens, minimize, translateUrl } from "./utils";
import { Buffer } from "buffer";
import logger from "./logger";

export class Speed {
    static SLOW = true;
    static NORMAL = false;
}

/**
 * Exception that uses context to present a meaningful error message
 */
export class gTTSError extends Error {
    public tts?: gTTS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public response?: any; // Request response object

    constructor(msg?: string | null, { tts, response }: { tts?: gTTS, response?: any } = {}) {
        super(msg || undefined);
        this.tts = tts;
        this.response = response;
        if (!msg && tts) {
            this.message = this.inferMsg(tts, response);
        } else if (msg) {
            this.message = msg;
        }
    }

    private inferMsg(tts: gTTS, rsp?: Response): string {
        let cause = "Unknown";
        let premise = "Failed to connect";

        if (!rsp) {
            if (tts.tld !== "com") {
                const host = translateUrl(tts.tld);
                cause = `Host '${host}' is not reachable`;
            }
        } else {
            const status = rsp.status;
            const reason = rsp.statusText;

            premise = `${status} (${reason}) from TTS API`;

            if (status === 403) {
                cause = "Bad token or upstream API changes";
            } else if (status === 404 && tts.tld !== "com") {
                cause = `Unsupported tld '${tts.tld}'`;
            } else if (status === 200 && !tts.langCheck) {
                cause = `No audio stream in response. Unsupported language '${tts.lang}'`;
            } else if (status >= 500) {
                cause = "Upstream API error. Try again later.";
            }
        }

        return `${premise}. Probable cause: ${cause}`;
    }
}

export interface gTTSOptions {
    /** The text to be read. */
    text: string;
    /** Top-level domain for the Google Translate host, i.e `https://translate.google.<tld>`. Default is `com`. */
    tld?: string;
    /** The language (IETF language tag) to read the text in. Default is `en`. */
    lang?: string;
    /** Reads text more slowly. Defaults to `false`. */
    slow?: boolean;
    /**
     * Strictly enforce an existing `lang`, to catch a language error early.
     * If set to `true`, an error is raised if `lang` doesn't exist.
     * Setting `langCheck` to `false` skips Web requests (to validate language)
     * and therefore speeds up instantiation. Default is `true`.
     */
    langCheck?: boolean;
    /**
     * A list of zero or more functions that are called to transform (pre-process)
     * text before tokenizing. Those functions must take a string and return a string.
     */
    preProcessorFuncs?: ((text: string) => string)[];
    /**
     * A function that takes in a string and returns a list of string (tokens).
     */
    tokenizerFunc?: (text: string) => string[];
    /** Seconds to wait for the server to send data before giving up. */
    timeout?: number;
}

/**
 * gTTS -- Google Text-to-Speech.
 *
 * An interface to Google Translate's Text-to-Speech API.
 */
export class gTTS {
    public static GOOGLE_TTS_MAX_CHARS = 100;
    public static GOOGLE_TTS_HEADERS = {
        "Referer": "http://translate.google.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    };
    public static GOOGLE_TTS_RPC = "jQ1olc";

    public text: string;
    public tld: string;
    public lang: string;
    public slow: boolean;
    public langCheck: boolean;
    public preProcessorFuncs: ((text: string) => string)[];
    public tokenizerFunc: (text: string) => string[];
    public timeout?: number;
    public speed: boolean;

    /**
     * @param options - Options for the gTTS instance.
     */
    constructor({
        text,
        tld = "com",
        lang = "en",
        slow = false,
        langCheck = true,
        preProcessorFuncs = [
            preProcessors.toneMarks,
            preProcessors.endOfLine,
            preProcessors.abbreviations,
            preProcessors.wordSub,
        ],
        tokenizerFunc,
        timeout
    }: gTTSOptions) {
        if (!text) throw new Error("No text to speak");
        this.text = text;
        this.tld = tld;
        this.langCheck = langCheck;
        this.lang = lang;

        if (this.langCheck) {
            this.lang = fallbackDeprecatedLang(lang);
            const supportedLangs = ttsLangs();
            if (!(this.lang in supportedLangs)) {
                throw new Error(`Language not supported: ${lang}`);
            }
        }

        this.slow = slow;
        this.speed = slow ? Speed.SLOW : Speed.NORMAL;
        this.preProcessorFuncs = preProcessorFuncs;

        if (tokenizerFunc) {
            this.tokenizerFunc = tokenizerFunc;
        } else {
             const tokenizer = new Tokenizer([
                tokenizerCases.toneMarks,
                tokenizerCases.periodComma,
                tokenizerCases.colon,
                tokenizerCases.otherPunctuation,
            ]);
            this.tokenizerFunc = (t) => tokenizer.run(t);
        }

        this.timeout = timeout;
    }

    private tokenize(text: string): string[] {
        // Pre-clean
        text = text.trim();

        // Apply pre-processors
        for (const pp of this.preProcessorFuncs) {
            logger.debug(`pre-processing: ${pp.name}`);
            text = pp(text);
        }

        if (text.length <= gTTS.GOOGLE_TTS_MAX_CHARS) {
            return cleanTokens([text]);
        }

        // Tokenize
        logger.debug(`tokenizing: ${this.tokenizerFunc}`);
        const tokens = this.tokenizerFunc(text);
        const cleanedTokens = cleanTokens(tokens);
        const minTokens: string[] = [];

        for (const t of cleanedTokens) {
            minTokens.push(...minimize(t, " ", gTTS.GOOGLE_TTS_MAX_CHARS));
        }

        return minTokens.filter(t => t);
    }

    private prepareRequests(): { url: string; body: string }[] {
        const url = translateUrl(this.tld, "_/TranslateWebserverUi/data/batchexecute");
        const textParts = this.tokenize(this.text);

        logger.debug(`text_parts: ${textParts}`);
        logger.debug(`text_parts: ${textParts.length}`);

        if (!textParts.length) throw new Error("No text to send to TTS API");

        return textParts.map((part, idx) => {
             const data = this.packageRpc(part);
             logger.debug(`data-${idx}: ${data}`);
             return {
                 url,
                 body: data
             };
        });
    }

    private packageRpc(text: string): string {
        const parameter = [text, this.lang, this.speed, "null"];
        const escapedParameter = JSON.stringify(parameter);
        const rpc = [[[gTTS.GOOGLE_TTS_RPC, escapedParameter, null, "generic"]]];
        const escapedRpc = JSON.stringify(rpc);
        return `f.req=${encodeURIComponent(escapedRpc)}&`;
    }

    /**
     * Do the TTS API request(s) and stream bytes.
     *
     * @returns An async generator yielding buffers of audio data.
     * @throws {gTTSError} When there's an error with the API request.
     */
    public async *stream(): AsyncGenerator<Buffer> {
        const requests = this.prepareRequests();

        for (const [idx, req] of requests.entries()) {
            try {
                const response = await fetch(req.url, {
                    method: "POST",
                    headers: gTTS.GOOGLE_TTS_HEADERS,
                    body: req.body,
                    signal: this.timeout ? AbortSignal.timeout(this.timeout * 1000) : undefined
                });

                logger.debug(`headers-${idx}: ${JSON.stringify(response.headers)}`);
                logger.debug(`url-${idx}: ${response.url}`);
                logger.debug(`status-${idx}: ${response.status}`);

                if (!response.ok) {
                    throw new gTTSError(null, { tts: this, response });
                }

                const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process lines from buffer
                const lines = buffer.split("\n");
                // Keep the last part if it doesn't end with a newline
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.includes(gTTS.GOOGLE_TTS_RPC)) {
                         const audioSearch = line.match(/jQ1olc","\[\\"(.*)\\"]/)
                         if (audioSearch && audioSearch[1]) {
                             try {
                                 // Unescape backslashes because it is inside a JSON string
                                 const base64Text = audioSearch[1].replace(/\\\\/g, "\\");
                                 const audioBuffer = Buffer.from(base64Text, 'base64');
                                 yield audioBuffer;
                             } catch (e) {
                                 // ignore or log
                             }
                         }
                    }
                }
            }
             // Process remaining buffer
            if (buffer.length > 0) {
                   if (buffer.includes(gTTS.GOOGLE_TTS_RPC)) {
                         const audioSearch = buffer.match(/jQ1olc","\[\\"(.*)\\"]/)
                         if (audioSearch && audioSearch[1]) {
                             try {
                                 const base64Text = audioSearch[1].replace(/\\\\/g, "\\");
                                 const audioBuffer = Buffer.from(base64Text, 'base64');
                                 yield audioBuffer;
                             } catch (e) {
                             }
                         }
                    }
            }
            logger.debug(`part-${idx} created`);
            } catch (e) {
                 if (e instanceof gTTSError) throw e;
                 // Re-throw other errors (e.g. fetch errors) wrapped or as-is?
                 // Python catches RequestException and raises gTTSError.
                 throw new gTTSError(null, { tts: this, response: null });
            }
        }
    }

    /**
     * Do the TTS API request and write result to file.
     *
     * @param savefile - The path and file name to save the `mp3` to.
     */
    public async save(savefile: string): Promise<void> {
        const file = Bun.file(savefile);
        const writer = file.writer();

        for await (const chunk of this.stream()) {
            writer.write(chunk);
        }
        writer.end();
    }
}
