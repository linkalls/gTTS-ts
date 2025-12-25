import { gTTS } from "./tts";

async function main() {
    console.log("Testing gTTS...");
    try {
        const tts = new gTTS({
            text: "Hello, this is a test from Bun.",
            lang: "en",
            slow: false
        });
        await tts.save("test.mp3");
        console.log("Success! Saved to test.mp3");
    } catch (e) {
        console.error("Failed:", e);
    }
}

main();
