# gTTS

**gTTS** (Google Text-to-Speech), a library and CLI tool to interface with Google Translate's text-to-speech API.

This project has been ported to TypeScript and runs on Bun.

## Features

- Customizable speech-specific sentence tokenizer that allows for unlimited lengths of text to be read, all while keeping proper intonation, abbreviations, decimals and more;
- Customizable text pre-processors which can, for example, provide pronunciation corrections;
- Automatic retrieval of supported languages.

## Installation

```bash
bun install
```

## CLI Usage

```bash
bun run src/cli.ts "Hello world"
```

Arguments:
- `<text>`: The text to be read.

Options:
- `-f, --file <file>`: Read from `<file>` instead of `<text>`.
- `-o, --output <file>`: Write to `<file>` instead of stdout.
- `-s, --slow`: Read more slowly.
- `-l, --lang <lang>`: IETF language tag. Language to speak in. List documented tags with `--all`. Default: `en`.
- `-t, --tld <tld>`: Top-level domain for the Google host, i.e `https://translate.google.<tld>`. Default: `com`.
- `--nocheck`: Disable strict IETF language tag checking. Allow undocumented tags.
- `--all`: Print all documented available IETF language tags and exit.
- `--debug`: Show debug information.

## API Usage

```typescript
import { gTTS } from "./src/tts";

const tts = new gTTS({
    text: "Hello world",
    lang: "en",
    slow: false
});

await tts.save("hello.mp3");
```

## License

MIT
