// Web Audio playback: sampled GM instruments (steady state looped for long notes), synthesized
// percussion, a generated-impulse reverb, and a glue compressor. Works live or on an OfflineAudioContext.

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const db = x => Math.pow(10, x / 20);

export const INSTRUMENTS = {
  whistle:               { gain: -5,  norm: 1,  sustain: true,  attack: 0.025, release: 0.12, send: 0.32, pan: 0.05,  lp: 9000 },
  french_horn:           { gain: -6,  norm: 5,  sustain: true,  attack: 0.06,  release: 0.25, send: 0.42, pan: -0.2 },
  string_ensemble_1:     { gain: -9,  norm: -3, sustain: true,  attack: 0.12,  release: 0.5,  send: 0.45, pan: 0.15 },
  choir_aahs:            { gain: -7,  norm: 5,  sustain: true,  attack: 0.35,  release: 0.7,  send: 0.5,  pan: 0 },
  rock_organ:            { gain: -14, norm: -2, sustain: true,  attack: 0.006, release: 0.06, send: 0.15, pan: -0.25 },
  clarinet:              { gain: -6,  norm: 0,  sustain: true,  attack: 0.03,  release: 0.1,  send: 0.3,  pan: 0.2 },
  bassoon:               { gain: -5,  norm: 5,  sustain: true,  attack: 0.03,  release: 0.08, send: 0.25, pan: -0.15 },
  tuba:                  { gain: -8,  norm: -3, sustain: true,  attack: 0.03,  release: 0.08, send: 0.2,  pan: 0 },
  muted_trumpet:         { gain: -6,  norm: 5,  sustain: true,  attack: 0.03,  release: 0.12, send: 0.3,  pan: 0.1 },
  electric_bass_finger:  { gain: 1,   norm: -8, sustain: false, attack: 0.003, release: 0.05, send: 0.02, pan: 0,     lp: 2200 },
  electric_guitar_muted: { gain: -10, norm: 6,  sustain: false, attack: 0.002, release: 0.1,  send: 0.12, pan: 0.3 },
  electric_piano_1:      { gain: -12, norm: -4, sustain: false, attack: 0.003, release: 0.25, send: 0.2,  pan: -0.1 },
  orchestral_harp:       { gain: -7,  norm: 6,  sustain: false, attack: 0.003, release: 0.5,  send: 0.42, pan: 0.25 },
  pizzicato_strings:     { gain: -7,  norm: -2, sustain: false, attack: 0.003, release: 0.15, send: 0.3,  pan: -0.2 },
  glockenspiel:          { gain: -11, norm: 5,  sustain: false, attack: 0.002, release: 0.7,  send: 0.4,  pan: 0.2 },
};
const DRUMS = { kick: { gain: -17, send: 0.05 }, snare: { gain: -22, send: 0.25, pan: 0.05 }, hat: { gain: -25, send: 0.08, pan: -0.15 }, shaker: { gain: -25, send: 0.1, pan: 0.25 }, triangle: { gain: -24, send: 0.35, pan: -0.3 }, crash: { gain: -21, send: 0.3, pan: 0.1 } };
/** @type {[string, string[]][]} */
export const STEMS = [
  ['whistle', ['whistle']], ['bass', ['electric_bass_finger']], ['drums', ['kick', 'snare', 'hat', 'crash']], ['shaker', ['shaker']],
  ['triangle', ['triangle']], ['guitar', ['electric_guitar_muted']], ['wurly', ['electric_piano_1']], ['organ', ['rock_organ']],
  ['horns', ['french_horn']], ['strings', ['string_ensemble_1']], ['choir', ['choir_aahs']], ['harp', ['orchestral_harp']],
  ['clarinet', ['clarinet']], ['bassoon', ['bassoon']], ['tuba', ['tuba']], ['pizz strings', ['pizzicato_strings']],
  ['glock', ['glockenspiel']], ['muted trumpet', ['muted_trumpet']], ['reverb', ['reverb']],
];
const LOOP = { start: 1.0, end: 2.9, fade: 0.25 };
const CACHE = {};

function base64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function makeLoopable(buffer) {
  const sr = buffer.sampleRate, a = Math.floor(LOOP.start * sr), b = Math.min(Math.floor(LOOP.end * sr), buffer.length - 1), f = Math.floor(LOOP.fade * sr);
  if (b - a < 2 * f) return buffer;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < f; i++) { const w = i / f, dst = b - f + i, src = a - f + i; d[dst] = d[dst] * Math.cos(w * Math.PI / 2) + d[src] * Math.sin(w * Math.PI / 2); }
  }
  buffer.loopStart = a / sr; buffer.loopEnd = b / sr;
  return buffer;
}
function noiseBuffer(ctx, seconds, seed) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate), d = buf.getChannelData(0);
  let s = seed;
  for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }
  return buf;
}

export class Engine {
  // silent never connects to the speakers; the meters and the scope still run
  constructor(ctx, { silent = false } = {}) {
    this.ctx = ctx; this.silent = silent; this.banks = {}; this.active = new Set();
    this.noise = noiseBuffer(ctx, 2, 1234567);
    this.build();
  }
  impulse(seconds, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    let s = 987654321;
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        s = (s * 1664525 + 1013904223) >>> 0; lp += 0.35 * ((s / 2147483648) - 1 - lp);
        const t = i / ctx.sampleRate;
        d[i] = (t < 0.018 ? 0 : 1) * lp * Math.exp(-t / decay) * (1 - Math.exp(-t / 0.004));
      }
    }
    return buf;
  }
  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const lowShelf = ctx.createBiquadFilter(); lowShelf.type = 'lowshelf'; lowShelf.frequency.value = 140; lowShelf.gain.value = 1.5;
    const highShelf = ctx.createBiquadFilter(); highShelf.type = 'highshelf'; highShelf.frequency.value = 5500; highShelf.gain.value = -1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    const makeup = ctx.createGain(); makeup.gain.value = db(6);
    const clip = ctx.createWaveShaper();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4); }
    clip.curve = curve; clip.oversample = '2x';
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.8;
    this.bus = ctx.createGain();
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(2.4, 0.55);
    this.reverbReturn = ctx.createGain(); this.reverbReturn.gain.value = 0.9;
    this.space = ctx.createGain();
    this.reverb.connect(this.space).connect(this.reverbReturn).connect(this.bus);
    this.bus.connect(lowShelf).connect(highShelf).connect(comp).connect(makeup).connect(clip).connect(this.master).connect(this.analyser);
    if (!this.silent) this.analyser.connect(ctx.destination);
    this.strips = {};
    for (const [name, cfg] of Object.entries({ ...INSTRUMENTS, ...DRUMS })) {
      const input = ctx.createGain(); input.gain.value = db(cfg.gain + (cfg.norm || 0));
      const user = ctx.createGain(); input.connect(user);
      let node = user;
      if (cfg.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.lp; f.Q.value = 0.5; node.connect(f); node = f; }
      const pan = ctx.createStereoPanner(); pan.pan.value = cfg.pan || 0; node.connect(pan); pan.connect(this.bus);
      const send = ctx.createGain(); send.gain.value = cfg.send || 0; pan.connect(send).connect(this.reverb);
      this.strips[name] = { input, user, send };
    }
    this.meters = {};
    for (const [stem, strips] of STEMS) {
      const m = ctx.createAnalyser(); m.fftSize = 1024; m.smoothingTimeConstant = 0;
      if (stem === 'reverb') this.reverbReturn.connect(m); else for (const st of strips) this.strips[st].user.connect(m);
      this.meters[stem] = m;
    }
  }
  /** time-domain samples of one stem after its fader, for the scope @param {string} stem @param {Float32Array} out */
  wave(stem, out) { this.meters[stem]?.getFloatTimeDomainData(out); }
  /** station room size, 0.6 dry to 1.4 roomy @param {number} x */
  setSpace(x) { this.space.gain.setTargetAtTime(x, this.ctx.currentTime, 0.1); }
  setLevel(name, v) {
    const p = name === 'reverb' ? this.reverbReturn.gain : this.strips[name]?.user.gain;
    if (p) p.setTargetAtTime(name === 'reverb' ? 0.9 * v : v, this.ctx.currentTime, 0.02);
  }
  /** @param {Record<string, Record<string, string>>} samples @param {(p: number, inst: string) => void} [onProgress] */
  async load(samples, onProgress) {
    const names = Object.keys(INSTRUMENTS).filter(n => samples[n]);
    let done = 0, total = 0; for (const n of names) total += Object.keys(samples[n]).length;
    for (const inst of names) {
      if (CACHE[inst]) { this.banks[inst] = CACHE[inst]; done += CACHE[inst].size; onProgress?.(done / total, inst); continue; }
      const bank = new Map(), cfg = INSTRUMENTS[inst];
      await Promise.all(Object.entries(samples[inst]).map(async ([note, b64]) => {
        const m = NOTE_NAMES.indexOf(note.replace(/\d+$/, '')) + 12 * (parseInt(note.match(/\d+$/)[0], 10) + 1);
        try { const buf = await this.ctx.decodeAudioData(base64ToBytes(b64)); bank.set(m, cfg.sustain ? makeLoopable(buf) : buf); } catch (e) { console.warn('decode failed', inst, note, e); }
        done++; onProgress?.(done / total, inst);
      }));
      this.banks[inst] = bank; CACHE[inst] = bank;
    }
  }
  nearest(bank, midi) {
    if (bank.has(midi)) return { buffer: bank.get(midi), rate: 1 };
    let best = null, bd = 99;
    for (const k of bank.keys()) { const d = Math.abs(k - midi); if (d < bd) { bd = d; best = k; } }
    return { buffer: bank.get(best), rate: Math.pow(2, (midi - best) / 12) };
  }
  track(src) { this.active.add(src); src.onended = () => this.active.delete(src); }
  play(inst, midi, t, dur, vel, extra = {}) {
    const cfg = INSTRUMENTS[inst], bank = this.banks[inst]; if (!cfg || !bank?.size) return;
    const ctx = this.ctx, { buffer, rate } = this.nearest(bank, midi);
    const src = ctx.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
    if (cfg.sustain && buffer.loopEnd) { src.loop = true; src.loopStart = buffer.loopStart; src.loopEnd = buffer.loopEnd; }
    const g = ctx.createGain(), v = Math.pow(Math.max(0.02, Math.min(1, vel)), 1.4), end = t + Math.max(0.03, dur);
    g.gain.setValueAtTime(0.0001, t);
    if (extra.swell) { g.gain.linearRampToValueAtTime(v * 0.35, t + cfg.attack); g.gain.linearRampToValueAtTime(v, t + Math.max(cfg.attack + 0.05, dur * 0.55)); }
    else g.gain.linearRampToValueAtTime(v, t + cfg.attack);
    g.gain.setValueAtTime(v, end); g.gain.linearRampToValueAtTime(0.0001, end + cfg.release);
    if (extra.glide) { src.playbackRate.setValueAtTime(rate * Math.pow(2, extra.glide / 12), t); src.playbackRate.exponentialRampToValueAtTime(rate, t + (extra.glideTime || 0.1)); }
    src.connect(g).connect(this.strips[inst].input);
    src.start(t); src.stop(end + cfg.release + 0.05); this.track(src);
  }
  burst(t, out, v, attack, decay, filters, offset) {
    const ctx = this.ctx, n = ctx.createBufferSource(); n.buffer = this.noise;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    let node = n; for (const f of filters) { node.connect(f); node = f; }
    node.connect(g).connect(out); n.start(t, offset); n.stop(t + decay + 0.05); this.track(n);
  }
  filter(type, freq, q) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
  kick(t, vel) {
    const ctx = this.ctx, out = this.strips.kick.input, o = ctx.createOscillator();
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(56, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.34);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4); this.track(o);
    this.burst(t, out, vel * 0.18, 0.001, 0.01, [this.filter('bandpass', 2800, 1.2)], Math.random() * 1.5);
  }
  snare(t, vel) {
    const ctx = this.ctx, out = this.strips.snare.input, o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(215, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.7, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.15); this.track(o);
    this.burst(t, out, vel, 0.002, vel < 0.5 ? 0.08 : 0.17, [this.filter('highpass', 650), this.filter('bandpass', 1700 + Math.random() * 300, 0.6)], Math.random() * 1.5);
  }
  metal(t, out, v, decay, hpHz, mult) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    g.connect(this.filter('highpass', hpHz)).connect(this.filter('bandpass', 8000, 0.5)).connect(out);
    for (const r of [296, 442, 587, 838, 1052, 1373]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = r * mult; o.connect(g); o.start(t); o.stop(t + decay + 0.02); this.track(o); }
  }
  hat(t, vel, open) { this.metal(t, this.strips.hat.input, vel * 0.5, open ? 0.32 : 0.045, 7500, 4.2); }
  crash(t, vel) {
    const out = this.strips.crash.input;
    this.burst(t, out, vel * 0.8, 0.004, 1.5, [this.filter('highpass', 3200), this.filter('bandpass', 6000, 0.35)], Math.random());
    this.metal(t, out, vel * 0.25, 1.1, 5000, 3.7);
  }
  shaker(t, vel) { this.burst(t, this.strips.shaker.input, vel, 0.014, 0.09, [this.filter('highpass', 3500), this.filter('bandpass', 6200 + Math.random() * 600, 1.1)], Math.random() * 1.8); }
  triangle(t, vel, muted, pitch = 1) {
    const ctx = this.ctx, decay = muted ? 0.1 : 1.7, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.45, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    g.connect(this.filter('highpass', 2500)).connect(this.strips.triangle.input);
    const det = pitch * (1 + (Math.random() - 0.5) * 0.01);
    for (const [f, a] of [[2870, 1], [4610, 0.6], [6930, 0.45], [9040, 0.3], [11780, 0.18]]) {
      const o = ctx.createOscillator(); o.frequency.value = f * det; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + decay + 0.05); this.track(o);
    }
  }
  // tuning between stations
  static_(t, seconds, level = 0.25) {
    const bp = this.filter('bandpass', 1800, 0.6); bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(3500, t + seconds);
    this.burst(t, this.bus, level, 0.02, seconds, [this.filter('highpass', 300), bp], Math.random());
  }
  scheduleBar(bar, t0, notBefore = 0) {
    const spb = 60 / bar.tempo;
    for (const e of bar.events) {
      const t = t0 + e.t * spb + (Math.random() - 0.5) * 0.008, dur = e.dur * spb;
      if (t < notBefore) continue;
      switch (e.inst) {
        case 'kick': this.kick(t, e.vel); break;
        case 'snare': this.snare(t, e.vel); break;
        case 'hat': this.hat(t, e.vel, !!e.open); break;
        case 'shaker': this.shaker(t, e.vel); break;
        case 'triangle': this.triangle(t, e.vel, !!e.muted, e.pitch); break;
        case 'crash': this.crash(t, e.vel); break;
        default: this.play(e.inst, e.note, t, dur, e.vel, e);
      }
    }
  }
  panic() { for (const s of Array.from(this.active)) { try { s.stop(); } catch (e) { /* already stopped */ } } this.active.clear(); }
}

// Live playback of one station, tuned in at the station's current time.
