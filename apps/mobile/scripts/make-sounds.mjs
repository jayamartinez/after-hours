// Synthesizes the app's two message sounds (D-046) into assets/sounds as 16-bit mono WAV.
// Original sounds made for After Hours; rerun with `node scripts/make-sounds.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44_100;
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** A sine note with a soft attack and exponential decay, plus a quiet octave for warmth. */
function note(samples, { start, freq, length, gain, decay }) {
  const from = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  for (let i = 0; i < count && from + i < samples.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    const envelope = attack * Math.exp(-t / decay);
    const tone = Math.sin(2 * Math.PI * freq * t) + 0.18 * Math.sin(2 * Math.PI * 2 * freq * t);
    samples[from + i] += gain * envelope * tone;
  }
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Send: a short, soft tap (about 80 ms).
const send = new Float64Array(Math.round(0.09 * RATE));
note(send, { start: 0, freq: 1320, length: 0.09, gain: 0.22, decay: 0.018 });
note(send, { start: 0, freq: 660, length: 0.09, gain: 0.12, decay: 0.025 });

// Reply: a warm two-note chime, a rising fourth (E5 then A5).
const reply = new Float64Array(Math.round(0.75 * RATE));
note(reply, { start: 0, freq: 659.25, length: 0.5, gain: 0.26, decay: 0.12 });
note(reply, { start: 0.11, freq: 880, length: 0.64, gain: 0.26, decay: 0.18 });

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'send.wav'), wav(send));
writeFileSync(path.join(outDir, 'reply.wav'), wav(reply));
console.log(`wrote ${outDir}/send.wav and reply.wav`);
