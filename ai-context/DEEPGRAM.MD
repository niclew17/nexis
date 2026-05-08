## Deepgram API call Example

JavaScript```

import { DeepgramClient } from '@deepgram/sdk';

const DEEPGRAM_API_KEY = 'b69dbcf115267fcb145396f537e0df16e8363fbb';

// Note: This is an English stream, update accordingly for other languages
const STREAM_URL = 'https://playerservices.streamtheworld.com/api/livestream-redirect/CSPANRADIOAAC.aac';

const live = async () => {
const deepgram = new DeepgramClient({ apiKey: DEEPGRAM_API_KEY });

const socket = await deepgram.listen.v1.createConnection({
model: 'nova-3',
language: 'en',
smart_format: true,
interim_results: true,
utterance_end_ms: 1500,
endpointing: 500,
punctuate: true,
numerals: true,
});

socket.on('message', (data) => {
if (data.type === 'UtteranceEnd') {
console.log(`[Event  ] UtteranceEnd (${data.last_word_end}s)`);
return;
}
if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
const transcript = data.channel.alternatives[0].transcript;
const prefix = data.is_final ? '[ FINAL ]' : '[Interim]';
if (transcript) {
console.log(`${prefix} ${transcript}`);
}
}
});

socket.on('close', () => {
console.log('Connection closed.');
});

socket.on('error', (err) => {
console.error(err);
});

socket.connect();
await socket.waitForOpen();

console.log(`Transcribing ${STREAM_URL}...`);

const response = await fetch(STREAM_URL, { redirect: 'follow' });
const reader = response.body.getReader();

const pump = async () => {
const { done, value } = await reader.read();
if (done) return;
socket.sendMedia(value);
return pump();
};
pump().catch(console.error);
}

live().catch(console.error);

```

```
