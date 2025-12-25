import { Command, Option } from "commander";
import { gTTS, gTTSError } from "./tts";
import { ttsLangs, fallbackDeprecatedLang } from "./lang";
import packageJson from "../package.json";
import logger from "./logger";

const program = new Command();

program
    .name("gtts")
    .description("Read <text> to mp3 format using Google Translate's Text-to-Speech API")
    .version(packageJson.version);

program
    .argument('[text]', 'text to speak')
    .option('-f, --file <file>', 'Read from <file> instead of <text>.')
    .option('-o, --output <file>', 'Write to <file> instead of stdout.')
    .option('-s, --slow', 'Read more slowly.', false)
    .option('-l, --lang <lang>', 'IETF language tag. Language to speak in. List documented tags with --all.', 'en')
    .option('-t, --tld <tld>', 'Top-level domain for the Google host, i.e https://translate.google.<tld>', 'com')
    .option('--nocheck', 'Disable strict IETF language tag checking. Allow undocumented tags.', false)
    .option('--all', 'Print all documented available IETF language tags and exit.', false)
    .option('--debug', 'Show debug information.', false)
    .action(async (textArg, options) => {
        if (options.debug) {
            logger.level = 'debug';
        }

        if (options.all) {
            const langs = ttsLangs();
            const sortedLangs = Object.entries(langs)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([code, name]) => `${code}: ${name}`);
            console.log("  " + sortedLangs.join("\n  "));
            process.exit(0);
        }

        let text = textArg;
        if (!text && !options.file) {
            console.error("Error: <text> or -f/--file <file> required");
            process.exit(1);
        }
        if (text && options.file) {
            console.error("Error: <text> and -f/--file <file> can't be used together");
            process.exit(1);
        }

        if (options.file) {
            if (options.file === '-') {
                // Read from stdin
                // Bun.stdin.text() is async
                text = await Bun.stdin.text();
            } else {
                try {
                    text = await Bun.file(options.file).text();
                } catch (e: any) {
                    console.error(`Error reading file ${options.file}: ${e.message}`);
                    process.exit(1);
                }
            }
        } else if (text === '-') {
             text = await Bun.stdin.text();
        }

        let lang = options.lang;
        if (!options.nocheck) {
            try {
                // Check if lang is valid
                 if (!(fallbackDeprecatedLang(lang) in ttsLangs())) {
                     // Check again directly just in case fallback logic differs
                      if (!(lang in ttsLangs())) {
                          console.error(`'${lang}' not in list of supported languages.\nUse --all to list languages or add --nocheck to disable language check.`);
                          process.exit(1);
                      }
                 }
            } catch (e) {
                // ignore
            }
        }

        try {
            const tts = new gTTS({
                text: text,
                lang: lang,
                slow: options.slow,
                tld: options.tld,
                langCheck: !options.nocheck
            });

            if (options.output) {
                await tts.save(options.output);
            } else {
                // Write to stdout
                // In Bun, `Bun.write(Bun.stdout, ...)`
                const writer = Bun.stdout.writer();
                for await (const chunk of tts.stream()) {
                    writer.write(chunk);
                }
                writer.end();
            }
        } catch (e: any) {
            if (e instanceof gTTSError) {
                console.error(`Error: ${e.message}`);
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }

    });

program.parse(process.argv);
