// engine.js — Web Audio playback for the composer's events. Sampled GM instruments (window.SF, loaded by
// samples/*.js), synthesized drums/shaker/triangle, a convolution reverb with a generated impulse, and a
// glue compressor on the master. Works on an AudioContext (live) or an OfflineAudioContext (renders).
(function (global) {
  'use strict';

  const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const noteName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const db = x => Math.pow(10, x / 20);

  // gain: mix level. norm: brings the sample set to a common loudness (measured per instrument).
  // sustain: loop the sample's steady state for long notes. send: reverb send. lp: lowpass Hz.
  const INSTRUMENTS = {
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
    electric_guitar_muted: { gain: -10, norm: 6,  sustain: false, attack: 0.002, release: 0.1, send: 0.12, pan: 0.3 },
    electric_piano_1:      { gain: -12, norm: -4, sustain: false, attack: 0.003, release: 0.25, send: 0.2,  pan: -0.1 },
    orchestral_harp:       { gain: -7,  norm: 6,  sustain: false, attack: 0.003, release: 0.5,  send: 0.42, pan: 0.25 },
    pizzicato_strings:     { gain: -7,  norm: -2, sustain: false, attack: 0.003, release: 0.15, send: 0.3,  pan: -0.2 },
    glockenspiel:          { gain: -11, norm: 5,  sustain: false, attack: 0.002, release: 0.7,  send: 0.4,  pan: 0.2 },
  };
  const DRUMS = { kick: { gain: -17, send: 0.05, pan: 0 }, snare: { gain: -22, send: 0.25, pan: 0.05 }, hat: { gain: -25, send: 0.08, pan: -0.15 }, shaker: { gain: -25, send: 0.1, pan: 0.25 }, triangle: { gain: -24, send: 0.35, pan: -0.3 }, crash: { gain: -21, send: 0.3, pan: 0.1 } };
  const CACHE = {};
  const LOOP = { start: 1.0, end: 2.9, fade: 0.25 }; // seconds; the mp3 renders are 3.16 s with a flat steady state

  function base64ToBytes(b64) {
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  // make the loop region seamless: the last `fade` seconds of the region are crossfaded toward the audio that precedes loopStart
  function makeLoopable(buffer) {
    const sr = buffer.sampleRate, a = Math.floor(LOOP.start * sr), b = Math.min(Math.floor(LOOP.end * sr), buffer.length - 1), f = Math.floor(LOOP.fade * sr);
    if (b - a < 2 * f) return buffer;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < f; i++) {
        const w = i / f; const dst = b - f + i, src = a - f + i;
        d[dst] = d[dst] * Math.cos(w * Math.PI / 2) + d[src] * Math.sin(w * Math.PI / 2);
      }
    }
    buffer.loopStart = a / sr; buffer.loopEnd = b / sr;
    return buffer;
  }

  class Engine {
    constructor(ctx) {
      this.ctx = ctx; this.banks = {}; this.active = new Set();
      this.noise = this.makeNoise(2);
      this.buildGraph();
    }
    makeNoise(seconds) {
      const ctx = this.ctx, buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate), d = buf.getChannelData(0);
      let s = 1234567;
      for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; }
      return buf;
    }
    makeImpulse(seconds, decay) {
      const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
      let s = 987654321;
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c); let lp = 0; const k = 0.35;
        for (let i = 0; i < n; i++) {
          s = (s * 1664525 + 1013904223) >>> 0; const w = (s / 2147483648) - 1;
          lp += k * (w - lp); // darken the tail
          const t = i / ctx.sampleRate;
          const pre = t < 0.018 ? 0 : 1;
          d[i] = pre * lp * Math.exp(-t / decay) * (1 - Math.exp(-t / 0.004));
        }
      }
      return buf;
    }
    buildGraph() {
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      this.lowShelf = ctx.createBiquadFilter(); this.lowShelf.type = 'lowshelf'; this.lowShelf.frequency.value = 140; this.lowShelf.gain.value = 1.5;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -20; this.comp.knee.value = 14; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
      this.highShelf = ctx.createBiquadFilter(); this.highShelf.type = 'highshelf'; this.highShelf.frequency.value = 5500; this.highShelf.gain.value = -1;
      this.makeup = ctx.createGain(); this.makeup.gain.value = db(6);
      this.clip = ctx.createWaveShaper();
      const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4); }
      this.clip.curve = curve; this.clip.oversample = '2x';
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = 0.82;
      this.bus = ctx.createGain();
      this.reverb = ctx.createConvolver(); this.reverb.buffer = this.makeImpulse(2.4, 0.55);
      this.reverbReturn = ctx.createGain(); this.reverbReturn.gain.value = 0.9;
      this.reverb.connect(this.reverbReturn).connect(this.bus);
      this.bus.connect(this.lowShelf).connect(this.highShelf).connect(this.comp).connect(this.makeup).connect(this.clip).connect(this.master).connect(this.analyser).connect(ctx.destination);
      this.strips = {};
      for (const [name, cfg] of Object.entries(Object.assign({}, INSTRUMENTS, DRUMS))) {
        const input = ctx.createGain(); input.gain.value = db(cfg.gain + (cfg.norm || 0));
        let node = input;
        if (cfg.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.lp; f.Q.value = 0.5; node.connect(f); node = f; }
        const pan = ctx.createStereoPanner(); pan.pan.value = cfg.pan || 0; node.connect(pan);
        pan.connect(this.bus);
        const send = ctx.createGain(); send.gain.value = cfg.send || 0; pan.connect(send).connect(this.reverb);
        this.strips[name] = { input, pan, send };
      }
    }
    async load(onProgress) {
      const sf = global.SF || {};
      const names = Object.keys(INSTRUMENTS).filter(n => sf[n]);
      let done = 0, total = 0; for (const n of names) total += Object.keys(sf[n]).length;
      for (const inst of names) {
        if (CACHE[inst]) { this.banks[inst] = CACHE[inst]; done += CACHE[inst].size; if (onProgress) onProgress(done / total, inst); continue; }
        const bank = new Map(); const cfg = INSTRUMENTS[inst];
        const jobs = Object.entries(sf[inst]).map(async ([note, uri]) => {
          const m = NOTE_NAMES.indexOf(note.replace(/\d+$/, '')) + 12 * (parseInt(note.match(/\d+$/)[0], 10) + 1);
          try {
            const buf = await this.ctx.decodeAudioData(base64ToBytes(uri.includes(',') ? uri.split(',')[1] : uri));
            bank.set(m, cfg.sustain ? makeLoopable(buf) : buf);
          } catch (e) { console.warn('decode failed', inst, note, e); }
          done++; if (onProgress) onProgress(done / total, inst);
        });
        await Promise.all(jobs);
        this.banks[inst] = bank; CACHE[inst] = bank;
      }
      this.loaded = true;
    }
    nearest(bank, midi) {
      if (bank.has(midi)) return { buffer: bank.get(midi), rate: 1 };
      let best = null, bd = 99;
      for (const k of bank.keys()) { const d = Math.abs(k - midi); if (d < bd) { bd = d; best = k; } }
      return { buffer: bank.get(best), rate: Math.pow(2, (midi - best) / 12) };
    }
    // ---- sampled voice ----
    play(inst, midi, t, dur, vel, extra) {
      const cfg = INSTRUMENTS[inst], bank = this.banks[inst]; if (!cfg || !bank || !bank.size) return;
      const ctx = this.ctx; extra = extra || {};
      const { buffer, rate } = this.nearest(bank, midi);
      const src = ctx.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
      if (cfg.sustain && buffer.loopEnd) { src.loop = true; src.loopStart = buffer.loopStart; src.loopEnd = buffer.loopEnd; }
      const g = ctx.createGain(); const v = Math.pow(Math.max(0.02, Math.min(1, vel)), 1.4);
      const a = cfg.attack, rel = cfg.release, end = t + Math.max(0.03, dur);
      g.gain.setValueAtTime(0.0001, t);
      if (extra.swell) { g.gain.linearRampToValueAtTime(v * 0.35, t + a); g.gain.linearRampToValueAtTime(v, t + Math.max(a + 0.05, dur * 0.55)); }
      else g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.setValueAtTime(v, end); g.gain.linearRampToValueAtTime(0.0001, end + rel);
      if (extra.glide) {
        src.playbackRate.setValueAtTime(rate * Math.pow(2, extra.glide / 12), t);
        src.playbackRate.exponentialRampToValueAtTime(rate, t + (extra.glideTime || 0.1));
      }
      src.connect(g).connect(this.strips[inst].input);
      src.start(t); src.stop(end + rel + 0.05);
      this.track(src);
    }
    track(src) { this.active.add(src); src.onended = () => this.active.delete(src); }
    // ---- synthesized percussion ----
    kick(t, vel) {
      const ctx = this.ctx, out = this.strips.kick.input, v = vel;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(56, t + 0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.34);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.4); this.track(o);
      const n = ctx.createBufferSource(); n.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 1.2;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 0.18, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.01);
      n.connect(f).connect(ng).connect(out); n.start(t, Math.random() * 1.5); n.stop(t + 0.03); this.track(n);
    }
    snare(t, vel) {
      const ctx = this.ctx, out = this.strips.snare.input, v = vel;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(215, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.7, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.15); this.track(o);
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 650;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 + Math.random() * 300; bp.Q.value = 0.6;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(v, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.0005, t + (v < 0.5 ? 0.08 : 0.17));
      n.connect(hp).connect(bp).connect(ng).connect(out); n.start(t, Math.random() * 1.5); n.stop(t + 0.25); this.track(n);
    }
    metal(t, out, v, decay, hpHz, ratios) {
      const ctx = this.ctx, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpHz;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 8000; bp.Q.value = 0.5;
      g.connect(hp).connect(bp).connect(out);
      for (const r of ratios) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = r; o.connect(g); o.start(t); o.stop(t + decay + 0.02); this.track(o); }
    }
    hat(t, vel, open) {
      this.metal(t, this.strips.hat.input, vel * 0.5, open ? 0.32 : 0.045, 7500, [296, 442, 587, 838, 1052, 1373].map(x => x * 4.2));
    }
    crash(t, vel) {
      const ctx = this.ctx, out = this.strips.crash.input;
      const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = 0.35;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.8, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.5);
      n.connect(hp).connect(bp).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 1.6); this.track(n);
      this.metal(t, out, vel * 0.25, 1.1, 5000, [296, 442, 587, 838, 1052, 1373].map(x => x * 3.7));
    }
    shaker(t, vel) {
      const ctx = this.ctx, out = this.strips.shaker.input;
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6200 + Math.random() * 600; bp.Q.value = 1.1;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.014); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      n.connect(hp).connect(bp).connect(g).connect(out); n.start(t, Math.random() * 1.8); n.stop(t + 0.12); this.track(n);
    }
    triangle(t, vel, muted) {
      const ctx = this.ctx, out = this.strips.triangle.input, decay = muted ? 0.1 : 1.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.45, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; g.connect(hp).connect(out);
      const det = 1 + (Math.random() - 0.5) * 0.01;
      for (const [f, a] of [[2870, 1], [4610, 0.6], [6930, 0.45], [9040, 0.3], [11780, 0.18]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * det; const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + decay + 0.05); this.track(o);
      }
    }
    // ---- bar scheduling ----
    scheduleBar(bar, t0) {
      const spb = 60 / bar.tempo;
      for (const e of bar.events) {
        const jitter = (Math.random() - 0.5) * 0.008;
        const t = Math.max(this.ctx.currentTime + 0.001, t0 + e.t * spb + jitter); const dur = e.dur * spb;
        switch (e.inst) {
          case 'kick': this.kick(t, e.vel); break;
          case 'snare': this.snare(t, e.vel); break;
          case 'hat': this.hat(t, e.vel, !!e.open); break;
          case 'shaker': this.shaker(t, e.vel); break;
          case 'triangle': this.triangle(t, e.vel, !!e.muted); break;
          case 'crash': this.crash(t, e.vel); break;
          default: this.play(e.inst, e.note, t, dur, e.vel, e);
        }
      }
    }
    panic() { for (const s of Array.from(this.active)) { try { s.stop(); } catch (e) { } } this.active.clear(); }
  }

  // ---- live player ----
  class Player {
    constructor(engine, radio, onBar) { this.engine = engine; this.radio = radio; this.onBar = onBar; this.timer = null; this.nextTime = 0; this.pending = new Set(); }
    start() {
      const ctx = this.engine.ctx; this.nextTime = ctx.currentTime + 0.15;
      this.engine.master.gain.cancelScheduledValues(ctx.currentTime); this.engine.master.gain.setValueAtTime(0.0001, ctx.currentTime); this.engine.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.3);
      this.tick(); this.timer = setInterval(() => this.tick(), 90);
    }
    tick() {
      const ctx = this.engine.ctx;
      while (this.nextTime < ctx.currentTime + 0.7) {
        const bar = this.radio.nextBar(); const at = this.nextTime;
        this.engine.scheduleBar(bar, at);
        if (this.onBar) { const id = setTimeout(() => { this.pending.delete(id); this.onBar(bar); }, Math.max(0, (at - ctx.currentTime) * 1000)); this.pending.add(id); }
        this.nextTime += 4 * 60 / bar.tempo;
      }
    }
    stop() {
      clearInterval(this.timer); this.timer = null;
      for (const id of this.pending) clearTimeout(id); this.pending.clear();
      const ctx = this.engine.ctx, g = this.engine.master.gain;
      g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      setTimeout(() => this.engine.panic(), 300);
    }
    skip() { this.radio.skipCue(); }
  }

  // ---- offline render (used by the analysis loop, not by listeners) ----
  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate, out = new ArrayBuffer(44 + n * ch * 2), v = new DataView(out);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
    return out;
  }
  async function renderOffline(seconds, seed, opts, onProgress) {
    const ctx = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    const engine = new Engine(ctx); await engine.load(onProgress);
    const radio = global.Composer.createRadio(seed, opts);
    const log = []; let t = 0.05;
    // An offline graph processes every node from time zero, so schedule only a few seconds ahead and
    // top up at suspend points; otherwise a long render crawls.
    const AHEAD = 3.0;
    function scheduleUntil(limit) {
      while (t < limit && t < seconds) {
        const bar = radio.nextBar(); engine.scheduleBar(bar, t);
        log.push({ t: +t.toFixed(2), cue: bar.cue.id, sec: bar.section.name, chord: bar.chord.name, tempo: bar.tempo, key: bar.cue.keyName, layers: bar.layers.join(' '), title: bar.cue.title, mel: bar.cue.melodyInst });
        t += 4 * 60 / bar.tempo;
      }
    }
    function arm() {
      const at = Math.floor((t - 1.0) * 44100 / 128) * 128 / 44100;
      if (t >= seconds || at <= ctx.currentTime + 0.01 || at >= seconds - 0.05) return;
      ctx.suspend(at).then(() => { scheduleUntil(ctx.currentTime + AHEAD); arm(); ctx.resume(); });
    }
    scheduleUntil(AHEAD); arm();
    const buf = await ctx.startRendering();
    return { wav: encodeWav(buf), log };
  }

  global.Engine = { Engine, Player, renderOffline, encodeWav, INSTRUMENTS, noteName };
})(window);
