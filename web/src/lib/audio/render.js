// Offline rendering, for listening back to a station without a speaker in the loop.
import { Engine } from './engine.js';
import { createStation } from '../music/station.js';

export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, out = new ArrayBuffer(44 + n * ch * 2), v = new DataView(out);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
  return out;
}

// Offline render of a station from a station time; for the analysis loop, never for listeners.
/** @param {Record<string, Record<string, string>>} samples @param {number} stationId @param {number} stationTime @param {number} seconds @param {(p: number, inst: string) => void} [onProgress] */
export async function renderOffline(samples, stationId, stationTime, seconds, onProgress) {
  const ctx = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  const engine = new Engine(ctx); await engine.load(samples, onProgress);
  const station = createStation(stationId);
  /** @type {object[]} */
  const log = [];
  let q = station.tune(stationTime);
  const AHEAD = 3.0;
  let t = 0.05 - (stationTime - q.start);
  /** @param {number} limit */
  function scheduleUntil(limit) {
    while (t < limit && t < seconds) {
      const { bar } = q; engine.scheduleBar(bar, t, 0);
      log.push({ t: +t.toFixed(2), cue: bar.cue.id, sec: bar.section.name, chord: bar.chord, tempo: bar.tempo, key: bar.cue.keyName, mel: bar.cue.melodyInst, layers: bar.layers.join(' ') });
      t += bar.dur; q = station.next();
    }
  }
  function arm() {
    const at = Math.floor((t - 1.0) * 44100 / 128) * 128 / 44100;
    if (t >= seconds || at <= ctx.currentTime + 0.01 || at >= seconds - 0.05) return;
    ctx.suspend(at).then(() => { scheduleUntil(ctx.currentTime + AHEAD); arm(); ctx.resume(); });
  }
  scheduleUntil(AHEAD); arm();
  return { wav: encodeWav(await ctx.startRendering()), log };
}
