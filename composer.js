// composer.js — the music. Pure logic, no audio. Produces one bar of events at a time, forever.
// Style: 2000s family-comedy film score. Funk rhythm section (bass, muted guitar, drums, shaker,
// triangle, wurly/EP, rock organ) under a whistled tune, with french horns, strings, harp, choir,
// clarinet/bassoon/tuba for the goofy bits. Straight 16ths, ~100 bpm, major keys with a mixolydian lean.
(function (global) {
  'use strict';

  // ---------- rng ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  class Rng {
    constructor(seed) { this.r = mulberry32(seed); }
    f() { return this.r(); }
    i(n) { return Math.floor(this.r() * n); }
    range(a, b) { return a + this.r() * (b - a); }
    int(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
    chance(p) { return this.r() < p; }
    weighted(pairs) { // [[item, w], ...]
      let s = 0; for (const p of pairs) s += p[1];
      let x = this.r() * s;
      for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    }
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = this.i(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; }
  }

  // ---------- theory ----------
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const QUAL = {
    maj: [0, 4, 7], min: [0, 3, 7], dom: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10],
    sus4: [0, 5, 7], dim: [0, 3, 6], maj6: [0, 4, 7, 9],
  };
  // progressions: root = semitones above tonic. Each entry is one bar unless beats given.
  const PROGRESSIONS = [
    { name: 'vamp', w: 5, bars: [[0, 'maj'], [0, 'maj'], [0, 'maj'], [0, 'maj']], vamp: true },
    { name: 'I IV I V', w: 4, bars: [[0, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'dom']] },
    { name: 'I bVII IV I', w: 4, bars: [[0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']] },
    { name: 'I vi IV V', w: 3, bars: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
    { name: 'I V vi IV', w: 2, bars: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
    { name: 'ii V I', w: 2, bars: [[2, 'min7'], [7, 'dom'], [0, 'maj'], [0, 'maj']] },
    { name: 'I iii IV iv', w: 2, bars: [[0, 'maj'], [4, 'min'], [5, 'maj'], [5, 'min']] },
    { name: 'I II7 IV I', w: 3, bars: [[0, 'maj'], [2, 'dom'], [5, 'maj'], [0, 'maj']] },
    { name: 'vi IV I V', w: 2, bars: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
    { name: 'I bIII IV I', w: 2, bars: [[0, 'maj'], [3, 'maj'], [5, 'maj'], [0, 'maj']] },
    { name: 'I IV (8)', w: 3, bars: [[0, 'maj'], [0, 'maj'], [5, 'maj'], [5, 'maj'], [0, 'maj'], [0, 'maj'], [7, 'dom'], [7, 'dom']] },
    { name: 'I IV/I', w: 3, bars: [[0, 'maj'], [5, 'maj', 0], [0, 'maj'], [5, 'maj', 0]] },
    { name: 'I bVII (vamp)', w: 3, bars: [[0, 'maj'], [10, 'maj'], [0, 'maj'], [10, 'maj']] },
    { name: 'I vi ii V', w: 2, bars: [[0, 'maj6'], [9, 'min7'], [2, 'min7'], [7, 'dom']] },
  ];

  function chordTones(ch) { return QUAL[ch.q].map(x => (x + ch.root) % 12); }
  // scale used for melody over a chord: key major, with chord tones swapped in for their nearest scale neighbor
  function scaleFor(ch, key) {
    const sc = MAJOR.map(x => (x + (key || 0)) % 12);
    for (const t of chordTones(ch)) {
      if (sc.includes(t)) continue;
      // replace nearest scale degree (prefer the one a semitone away)
      let best = -1, bd = 99;
      for (let i = 0; i < sc.length; i++) { const d = Math.min((sc[i] - t + 12) % 12, (t - sc[i] + 12) % 12); if (d < bd) { bd = d; best = i; } }
      sc[best] = t;
    }
    return sc.sort((a, b) => a - b);
  }
  function nearestInSet(pc, set) { // pitch class -> nearest member (semitone distance), returns offset to add
    let best = 0, bd = 99;
    for (const s of set) { let d = ((s - pc) % 12 + 18) % 12 - 6; if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; } }
    return best;
  }
  function snapTo(midi, set) { return midi + nearestInSet(((midi % 12) + 12) % 12, set); }
  function scaleStep(midi, scale, steps) { // move by scale steps (scale = pitch classes sorted)
    let m = snapTo(midi, scale);
    const dir = steps > 0 ? 1 : -1;
    for (let k = 0; k < Math.abs(steps); k++) {
      let n = m + dir;
      while (!scale.includes(((n % 12) + 12) % 12)) n += dir;
      m = n;
    }
    return m;
  }

  // ---------- patterns ----------
  // 16-slot strings. x = hit, X = accent, . = rest, o = open hat, g = ghost
  const DRUM_PATTERNS = {
    kick: ['x.......x.......', 'x......x..x.....', 'x..x....x..x....', 'x.....x...x.....', 'x......x.x......', 'x..x......x.....', 'x.......x.x.....'],
    snare: ['....x.......x...', '....x.......x..g', '....x..g....x...', '....x.......x.g.', 'g...x.......x...'],
    hat: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.o.', 'X.x.X.x.X.x.X.x.', 'xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx', 'x.x.x.xxx.x.x.x.'],
  };
  const SHAKER = ['xXxxxXxxxXxxxXxx', 'XxxxXxxxXxxxXxxx', 'xxXxxxXxxxXxxxXx'];
  const GUITAR_PATTERNS = ['x.xx.x.xx.xx.x.x', 'x.xxx.xxx.xxx.xx', 'xx.xxx.xxx.xxx.x', 'x.x.xxx.x.x.xxx.', 'x.xx.xx.x.xx.xx.', 'xxxxxxxxxxxxxxxx', 'x..xx.xxx..xx.xx'];
  const EP_PATTERNS = ['......x.......x.', 'x.........x.....', '......x...x.....', 'x.....x.......x.', '..x.......x.....', 'x...............'];
  // bass patterns: [slot, len, what]; what: 'r' root, '5' fifth, 'o' octave, 'w1'/'w2' chromatic approach to next root (from below/above), '3' third, 'b7'
  const BASS_PATTERNS = [
    { name: 'ref', p: [[0, 12, 'r'], [12, 4, '5']] },
    { name: 'ref2', p: [[0, 6, 'r'], [6, 2, 'r'], [8, 4, 'r'], [12, 4, '5']] },
    { name: 'funk', p: [[0, 2, 'r'], [3, 1, 'r'], [4, 2, 'r'], [8, 2, 'r'], [10, 2, '5'], [12, 2, 'r'], [14, 2, 'w1']] },
    { name: 'walk', p: [[0, 4, 'r'], [4, 4, 'r'], [8, 4, '5'], [12, 2, 'w2'], [14, 2, 'w1']] },
    { name: 'sync', p: [[0, 3, 'r'], [3, 3, 'r'], [6, 2, '5'], [8, 4, 'r'], [12, 2, 'r'], [14, 2, 'o']] },
    { name: 'oct', p: [[0, 2, 'r'], [2, 2, 'o'], [4, 4, 'r'], [8, 2, 'r'], [10, 2, 'o'], [12, 2, '5'], [14, 2, 'w1']] },
    { name: 'long', p: [[0, 8, 'r'], [8, 4, 'r'], [12, 4, '5']] },
    { name: 'pop', p: [[0, 2, 'r'], [3, 3, 'r'], [6, 2, 'o'], [8, 2, 'r'], [11, 3, '5'], [14, 2, 'w1']] },
  ];
  // melody rhythm cells over a 2-bar phrase (32 sixteenths). positive = note length in 16ths, negative = rest.
  const MELODY_RHYTHMS = [
    [4, 4, 4, 4, 8, -8], [2, 2, 4, 2, 2, 4, 8, -8], [3, 3, 2, 3, 3, 2, 12, -4], [6, 2, 4, 4, 12, -4],
    [2, 2, 2, 2, 4, 4, 12, -4], [4, 2, 2, 4, 4, 12, -4], [-2, 2, 4, 4, 2, 2, 12, -4], [4, 4, 2, 2, 4, 8, -8],
    [2, 2, 2, 2, 2, 2, 4, 6, -10], [3, 3, 2, 8, 3, 3, 2, 8], [4, 2, 2, 2, 2, 4, 12, -4], [-4, 2, 2, 4, 4, 4, 8, -4],
    [2, 4, 2, 4, 4, 12, -4], [4, 4, 8, 4, 4, 8], [6, 6, 4, 6, 6, 4], [-2, 2, 2, 2, 4, 2, 2, 4, 8, -4],
  ];

  const MELODY_INSTRUMENTS = [['whistle', 7], ['clarinet', 2], ['glockenspiel', 1.2], ['muted_trumpet', 1.2], ['electric_piano_1', 1], ['whistle', 0]];
  const RANGE = { // comfortable register [low, high] in midi for melody use
    whistle: [67, 84], clarinet: [60, 84], glockenspiel: [84, 103], muted_trumpet: [60, 79], electric_piano_1: [67, 88],
    french_horn: [48, 72], string_ensemble_1: [48, 84], choir_aahs: [55, 79], orchestral_harp: [43, 96], bassoon: [36, 60],
    tuba: [29, 50], pizzicato_strings: [43, 79], rock_organ: [48, 84], electric_guitar_muted: [52, 76], electric_bass_finger: [31, 50],
  };

  // ---------- cue construction ----------
  function makeCue(rng, id, prev) {
    const keyChoices = [[7, 5], [0, 4], [2, 4], [5, 3], [9, 3], [10, 2], [4, 2], [3, 1], [11, 1]];
    let key;
    do { key = rng.weighted(keyChoices); } while (prev && key === prev.key && rng.chance(0.8));
    const tempo = Math.round(rng.range(94, 108));
    const prog = rng.weighted(PROGRESSIONS.map(p => [p, p.w]));
    const chords = prog.bars.map(b => ({ root: (b[0] + key) % 12, q: b[1], bass: b.length > 2 ? (b[2] + key) % 12 : (b[0] + key) % 12, deg: b[0] }));
    const melodyInst = rng.weighted(MELODY_INSTRUMENTS);
    const compInst = rng.weighted([['electric_piano_1', 5], ['rock_organ', 2], ['none', 1]]);
    const bassPat = rng.weighted(BASS_PATTERNS.map(p => [p, p.name === 'ref' || p.name === 'ref2' ? 3 : 1.5]));
    const drums = { kick: rng.pick(DRUM_PATTERNS.kick), snare: rng.pick(DRUM_PATTERNS.snare), hat: rng.pick(DRUM_PATTERNS.hat) };
    const shaker = rng.pick(SHAKER);
    const guitarPat = rng.pick(GUITAR_PATTERNS);
    const epPat = rng.pick(EP_PATTERNS);
    const ending = rng.weighted([['stop', 4], ['fill', 3], ['slide', 2]]);
    const organPad = rng.chance(0.6);
    const flavor = rng.weighted([['funk', 4], ['goofy', 2], ['sweet', 2], ['caper', 2]]);
    const introStyle = rng.weighted([['vamp', 4], ['slide', 2], ['solo', 2], ['oompah', flavor === 'goofy' ? 3 : 0.5], ['harp', flavor === 'sweet' ? 3 : 1]]);
    const afterFill = !!(prev && prev.ending === 'fill');
    // the triangle is a spice, not a constant: half the cues, three placements, its own pitch per cue
    const triangle = rng.chance(0.5);
    const trianglePattern = rng.weighted([['downbeat', 3], ['offbeat', 2], ['sparse', 2]]);
    const trianglePitch = rng.range(0.82, 1.18);
    const introDing = triangle && rng.chance(0.4);

    // section plan
    const plan = [];
    plan.push({ name: 'intro', bars: rng.pick([2, 4]) });
    plan.push({ name: 'groove', bars: 4 });
    plan.push({ name: 'A', bars: 8 });
    if (rng.chance(0.6)) plan.push({ name: 'build', bars: 4 });
    plan.push({ name: 'B', bars: 8 });
    if (rng.chance(0.6)) plan.push({ name: 'breakdown', bars: rng.pick([4, 8]) });
    if (rng.chance(0.8)) plan.push({ name: 'climax', bars: 8 });
    plan.push({ name: 'outro', bars: 1 });
    const total = plan.reduce((s, p) => s + p.bars, 0);

    return {
      id, key, keyName: KEY_NAMES[key], tempo, prog, chords, melodyInst, compInst, bassPat, drums, shaker, guitarPat, epPat, ending, flavor, plan, total, organPad, introStyle, afterFill, triangle, trianglePattern, trianglePitch, introDing,
      motifSeed: rng.i(1e9),
      title: `cue ${id}: ${KEY_NAMES[key]} ${prog.name}, ${tempo} bpm, ${flavor}`,
    };
  }

  // ---------- melody ----------
  // Generates an 8-bar melody as a list of {slot (16ths from section start), len, midi, ornament} using phrase structure A A' B A''.
  function generateMelody(rng, cue, inst, sectionBars, chordAt, opts) {
    const [lo, hi] = RANGE[inst];
    const center = Math.round((lo + hi) / 2) + (opts.lift || 0);
    const events = [];
    const phrases = sectionBars / 2; // 2-bar phrases
    const rhythmA = rng.pick(MELODY_RHYTHMS), rhythmB = rng.pick(MELODY_RHYTHMS);
    // contour for A: random walk with direction persistence
    function makePhrase(rhythm, startSlot, seedPitch, contourSign, finalHold) {
      const out = [];
      let slot = startSlot, pitch = seedPitch, dir = contourSign, prevLeap = 0;
      let idx = 0;
      const notesOnly = rhythm.filter(x => x > 0).length;
      for (const r of rhythm) {
        if (r < 0) { slot += -r; continue; }
        const ch = chordAt(slot);
        const scale = scaleFor(ch, cue.key);
        const tones = chordTones(ch);
        const strong = (slot % 8) === 0 || idx === notesOnly - 1;
        if (idx === 0) {
          pitch = snapTo(pitch, tones);
        } else {
          let move;
          if (prevLeap !== 0) { move = -Math.sign(prevLeap); prevLeap = 0; } // resolve leaps by step
          else {
            const x = rng.f();
            if (x < 0.14) move = 0;
            else if (x < 0.74) move = dir;
            else if (x < 0.92) move = dir * 2;
            else move = dir * (rng.chance(0.6) ? 3 : 4);
            if (rng.chance(0.28)) dir = -dir;
          }
          if (Math.abs(move) >= 3) prevLeap = move;
          pitch = scaleStep(pitch, scale, move);
          if (strong) pitch = snapTo(pitch, tones);
        }
        // keep in range, bounce
        if (pitch > hi) { pitch = scaleStep(pitch, scale, -(rng.int(3, 5))); dir = -1; }
        if (pitch < lo) { pitch = scaleStep(pitch, scale, rng.int(3, 5)); dir = 1; }
        const isLast = idx === notesOnly - 1;
        if (isLast && finalHold) pitch = snapTo(pitch, tones.slice(0, 3)); // end phrase on a triad tone
        let orn = null;
        if (r >= 8 && rng.chance(0.35)) orn = 'scoop';
        else if (r >= 4 && rng.chance(0.12)) orn = 'grace';
        out.push({ slot, len: r, midi: pitch, orn, vel: (strong ? 0.9 : 0.75) + rng.range(-0.08, 0.08) });
        slot += r; idx++;
      }
      return out;
    }
    let seed = snapTo(center + rng.int(-3, 3), chordTones(chordAt(0)));
    const A = makePhrase(rhythmA, 0, seed, rng.chance(0.55) ? 1 : -1, false);
    const structure = phrases === 4 ? ['A', 'A2', 'B', 'A3'] : Array.from({ length: phrases }, (_, i) => ['A', 'A2', 'B', 'A3'][i % 4]);
    for (let p = 0; p < phrases; p++) {
      const start = p * 32;
      const kind = structure[p];
      if (kind === 'A') { events.push(...A); continue; }
      if (kind === 'A2' || kind === 'A3') {
        // same rhythm and contour, re-snapped to the local harmony; A3 resolves and holds
        const src = A;
        let last = null;
        for (let i = 0; i < src.length; i++) {
          const e = src[i]; const slot = start + (e.slot);
          const ch = chordAt(slot); const scale = scaleFor(ch, cue.key); const tones = chordTones(ch);
          let midi = e.midi;
          const strong = (slot % 8) === 0 || i === src.length - 1;
          if (kind === 'A3' && i === src.length - 1) { midi = snapTo(midi, [cue.key, (cue.key + 4) % 12, (cue.key + 7) % 12]); }
          else if (strong) midi = snapTo(midi, tones);
          else if (!scale.includes(((midi % 12) + 12) % 12)) midi = snapTo(midi, scale);
          if (kind === 'A2' && i > 0 && rng.chance(0.25)) midi = scaleStep(midi, scale, rng.pick([-1, 1])); // little variation
          let len = e.len;
          if (kind === 'A3' && i === src.length - 1) len = Math.max(len, 12);
          events.push({ slot, len, midi, orn: e.orn, vel: e.vel });
          last = midi;
        }
        continue;
      }
      // B: contrasting phrase, different rhythm, opposite contour, starts higher or lower
      const ch = chordAt(start);
      const bseed = snapTo(A[0].midi + (rng.chance(0.5) ? 5 : -4), chordTones(ch));
      const B = makePhrase(rhythmB, start, bseed, A[A.length - 1].midi >= A[0].midi ? -1 : 1, true);
      events.push(...B);
    }
    // clip anything past the section
    return events.filter(e => e.slot < sectionBars * 16);
  }

  // ---------- the radio ----------
  function createRadio(seed, options) {
    const rng = new Rng((seed >>> 0) || 1);
    const opts = Object.assign({ energy: 1 }, options || {});
    let cueCount = 0, cue = null, prevCue = null, barInCue = 0, sectionIdx = 0, barInSection = 0;
    let sectionMelody = null, sectionLead2 = null, hornLine = null;
    let barsTotal = 0;
    const state = { cue: null, section: null, bar: 0 };

    function startCue() {
      prevCue = cue;
      cue = makeCue(rng, ++cueCount, prevCue);
      barInCue = 0; sectionIdx = 0; barInSection = 0; sectionMelody = null; sectionLead2 = null; hornLine = null;
      state.cue = cue;
    }
    function chordForBar(b) { return cue.chords[((b % cue.chords.length) + cue.chords.length) % cue.chords.length]; }
    function bassRootFor(b) { return chordForBar(b).bass; }

    function startSection() {
      const sec = cue.plan[sectionIdx];
      state.section = sec;
      barInSection = 0;
      sectionMelody = null; sectionLead2 = null; hornLine = null;
      const secStartBar = barInCue;
      const chordAt = slot => chordForBar(secStartBar + Math.floor(slot / 16));
      if (sec.name === 'A' || sec.name === 'B' || sec.name === 'climax') {
        const inst = sec.name === 'B' && rng.chance(0.4) ? rng.weighted([['clarinet', 3], ['glockenspiel', 2], ['muted_trumpet', 2], ['electric_piano_1', 1]]) : cue.melodyInst;
        sectionMelody = { inst, events: generateMelody(rng, cue, inst, sec.bars, chordAt, { lift: sec.name === 'climax' ? 2 : 0 }) };
        if (sec.name === 'climax') {
          sectionLead2 = rng.weighted([['string_ensemble_1', 3], ['glockenspiel', 2], ['clarinet', 1], ['none', 1]]);
        }
      }
      if (sec.name === 'intro' && cue.introStyle === 'solo') {
        sectionMelody = { inst: cue.melodyInst, events: generateMelody(rng, cue, cue.melodyInst, sec.bars, chordAt, {}) };
      }
      if (sec.name === 'breakdown') {
        // woodwind duet: clarinet tune + bassoon bounce, or harp arps. Reuse melody generator on clarinet.
        const style = cue.flavor === 'sweet' ? 'harp' : rng.weighted([['duet', 3], ['harp', 1.5], ['pizz', 1.5]]);
        sectionMelody = { inst: style === 'duet' ? 'clarinet' : (style === 'harp' ? 'orchestral_harp' : 'pizzicato_strings'), style, events: style === 'duet' ? generateMelody(rng, cue, 'clarinet', sec.bars, chordAt, {}) : [] };
      }
    }

    function nextBar() {
      if (!cue) { startCue(); startSection(); }
      const sec = cue.plan[sectionIdx];
      const ev = [];
      const b = barInCue;
      const ch = chordForBar(b);
      const nextCh = chordForBar(b + 1);
      const last = barInCue === cue.total - 1;
      const secLast = barInSection === sec.bars - 1;
      const tones = chordTones(ch);
      const E = opts.energy;
      const flavor = cue.flavor;
      const push = (t, dur, inst, note, vel, extra) => ev.push(Object.assign({ t, dur, inst, note, vel }, extra || {}));
      const slotT = s => s / 4;
      const grid = (pat, fn) => { for (let s = 0; s < 16; s++) { const c = pat[s]; if (c !== '.') fn(s, c); } };

      // ---- layer switches by section ----
      const S = sec.name;
      const L = {
        shaker: S !== 'outro' || cue.ending !== 'stop',
        triangle: cue.triangle,
        bass: S !== 'outro' && !(S === 'intro' && cue.flavor === 'sweet' && barInSection < 2),
        drums: ['groove', 'A', 'build', 'B', 'climax'].includes(S) || (S === 'intro' && barInSection >= 2 && rng.chance(0.5)) || (S === 'outro' && cue.ending === 'fill'),
        guitar: ['groove', 'A', 'build', 'B', 'climax'].includes(S) && flavor !== 'sweet',
        comp: ['groove', 'A', 'B', 'climax', 'build'].includes(S) || (S === 'intro' && barInSection >= 1),
        organStab: ['build', 'climax'].includes(S) && cue.compInst !== 'rock_organ',
        strings: ['build', 'B', 'climax'].includes(S) || (S === 'breakdown' && sectionMelody && sectionMelody.style === 'harp'),
        horns: ['build', 'climax'].includes(S) || (S === 'B' && flavor === 'caper'),
        choir: S === 'climax',
        tuba: (S === 'breakdown' && sectionMelody && sectionMelody.style === 'duet') || (flavor === 'goofy' && S === 'B'),
        bassoon: (S === 'breakdown' && sectionMelody && sectionMelody.style === 'duet') || (flavor === 'goofy' && ['B', 'climax'].includes(S)),
        pizz: (S === 'breakdown' && sectionMelody && sectionMelody.style === 'pizz') || (flavor === 'caper' && ['A', 'B'].includes(S)),
        harp: S === 'breakdown' && sectionMelody && sectionMelody.style === 'harp',
        organHold: false,
      };
      if (S === 'intro') {
        const st = cue.introStyle;
        L.bass = st === 'vamp' || (st === 'slide' && barInSection >= 1) || (st === 'harp' && secLast) || cue.afterFill;
        L.drums = cue.afterFill || (st === 'slide' ? secLast : (st === 'vamp' && barInSection >= 2 && rng.chance(0.5)));
        L.comp = st === 'vamp' && (barInSection >= 1 || cue.afterFill);
        L.strings = st === 'solo' || st === 'harp';
        L.harp = st === 'harp';
        L.tuba = st === 'oompah'; L.bassoon = st === 'oompah';
        L.shaker = st !== 'solo' || cue.afterFill;
        L.organHold = st === 'slide';
        L.guitar = cue.afterFill && st === 'vamp';
      }
      if (L.tuba) L.bass = false;
      if (S === 'breakdown') { L.drums = false; L.guitar = false; L.comp = false; }
      if (S === 'outro' && cue.ending === 'stop') { L.bass = false; L.guitar = false; L.comp = false; L.drums = false; }

      // ---- rhythm section ----
      if (L.shaker) grid(cue.shaker, (s, c) => push(slotT(s), 0.2, 'shaker', null, (c === 'X' ? 0.9 : 0.5) * (S === 'breakdown' ? 0.7 : 1)));
      if (L.triangle) {
        const tp = { pitch: cue.trianglePitch };
        if (cue.trianglePattern === 'downbeat') { if (b % 2 === 0 && rng.chance(0.85)) push(0, 1.5, 'triangle', null, 0.7, tp); }
        else if (cue.trianglePattern === 'offbeat') { if (rng.chance(0.8)) push(3.5, 1.2, 'triangle', null, 0.6, tp); }
        else if (b % 4 === 0) push(0, 1.5, 'triangle', null, 0.7, tp);
        if (rng.chance(0.25)) push(rng.pick([1.5, 2.5]), 0.3, 'triangle', null, 0.4, Object.assign({ muted: true }, tp));
        if (S === 'intro' && barInSection === 0 && cue.introDing) push(0, 2, 'triangle', null, 0.9, tp);
      }
      if (L.drums) {
        const fill = (secLast && rng.chance(0.6) && S !== 'outro') || (S === 'outro' && cue.ending === 'fill');
        const hatP = S === 'climax' ? (rng.chance(0.5) ? 'xxxxxxxxxxxxxxxx' : cue.drums.hat) : cue.drums.hat;
        grid(cue.drums.kick, s => push(slotT(s), 0.3, 'kick', null, 0.95));
        grid(cue.drums.snare, (s, c) => push(slotT(s), 0.3, 'snare', null, c === 'g' ? 0.3 : 0.9));
        grid(hatP, (s, c) => push(slotT(s), c === 'o' ? 0.6 : 0.08, 'hat', null, c === 'X' ? 0.75 : c === 'o' ? 0.6 : (s % 2 ? 0.35 : 0.55), c === 'o' ? { open: true } : null));
        if (fill) {
          // snare 16ths into the downbeat, with a kick on 1 of next bar handled by next bar
          const start = rng.pick([12, 10, 8]);
          for (let s = start; s < 16; s++) push(slotT(s), 0.2, 'snare', null, 0.45 + 0.5 * (s - start) / (16 - start));
          if (rng.chance(0.5)) push(3.75, 0.2, 'kick', null, 0.8);
        }
        if (barInSection === 0 && ['A', 'climax'].includes(S)) push(0, 1.5, 'crash', null, S === 'climax' ? 0.8 : 0.5);
        if (S === 'outro' && cue.ending === 'fill') push(3.75, 0.2, 'kick', null, 0.9);
      }
      if (L.bass) {
        const root = bassRootFor(b), nroot = bassRootFor(b + 1);
        const base = 33 + ((root - 9 + 12) % 12); // A1..Ab2, G2 for a G root like the reference
        const nbase = 33 + ((nroot - 9 + 12) % 12);
        let pat = cue.bassPat.p;
        if (S === 'intro' || S === 'breakdown') pat = BASS_PATTERNS[0].p;
        if (secLast && rng.chance(0.5) && S !== 'outro') pat = BASS_PATTERNS[3].p; // walk into the next section
        const third = ch.q === 'min' || ch.q === 'min7' ? 3 : 4;
        for (const [s, len, what] of pat) {
          let n = base;
          if (what === '5') n = base + 7; else if (what === 'o') n = base + 12; else if (what === '3') n = base + third;
          else if (what === 'w1') n = nbase - 1; else if (what === 'w2') n = nbase + (rng.chance(0.5) ? 1 : -2);
          if (n > 50) n -= 12; if (n < 31) n += 12;
          // the reference's chromatic wobble: G# G F# on the way home, once in a while
          push(slotT(s), Math.max(0.2, len / 4 - 0.05), 'electric_bass_finger', n, what === 'r' && s === 0 ? 0.95 : 0.8);
        }
        if (last && cue.ending === 'stop') { /* handled below */ }
      }
      if (L.tuba) {
        const root = bassRootFor(b); const base = 29 + ((root - 5 + 12) % 12); // F1..E2
        push(0, 0.45, 'tuba', base, 0.9); push(2, 0.45, 'tuba', base + (rng.chance(0.7) ? 7 : 5), 0.85);
        if (secLast) { push(3, 0.3, 'tuba', base + 4, 0.8); push(3.5, 0.3, 'tuba', base + 5, 0.8); }
      }
      if (L.guitar) {
        // 3-note voicing between G3 and E5 on muted guitar, scratching the pattern
        const voicing = voiceChord(ch, 55, 76, 3);
        grid(cue.guitarPat, s => { for (const n of voicing) push(slotT(s) + 0.005, 0.16, 'electric_guitar_muted', n, (s % 4 === 0 ? 0.7 : s % 2 ? 0.38 : 0.55) * E); });
        // occasional single-string pickup
        if (rng.chance(0.15)) push(3.5, 0.12, 'electric_guitar_muted', voicing[0] - 12, 0.5);
      }
      if (L.comp && cue.compInst !== 'none') {
        const inst = cue.compInst;
        const voicing = voiceChord(ch, inst === 'rock_organ' ? 55 : 60, inst === 'rock_organ' ? 76 : 79, ch.q.length > 3 ? 4 : 3);
        let pat = cue.epPat;
        if (S === 'intro') pat = 'x...............';
        // the bed: a held wurly chord every bar, plus an organ pad when the wurly is also doing the comping
        const held = voiceChord(ch, 55, 74, 3);
        for (const n of held) push(0, 3.85, 'electric_piano_1', n, S === 'intro' ? 0.4 : 0.5);
        if (inst !== 'rock_organ' && S !== 'intro' && cue.organPad) for (const n of voiceChord(ch, 55, 74, 3)) push(0, 3.9, 'rock_organ', n, 0.35);
        grid(pat, s => { for (const n of voicing) push(slotT(s), inst === 'rock_organ' ? 0.4 : 0.9, inst, n, 0.65); });
        if (rng.chance(0.12) && S !== 'intro') { const sc = scaleFor(ch, cue.key); const a = voicing[voicing.length - 1]; push(3.5, 0.2, inst, scaleStep(a, sc, 1), 0.5); push(3.75, 0.2, inst, scaleStep(a, sc, 2), 0.5); }
      }
      if (L.organStab && barInSection % 2 === 1) {
        const voicing = voiceChord(ch, 60, 79, 3);
        for (const n of voicing) push(1.5, 0.25, 'rock_organ', n, 0.55);
        if (rng.chance(0.5)) for (const n of voicing) push(3.5, 0.25, 'rock_organ', n, 0.5);
      }
      if (L.organHold && barInSection === 0) {
        const v = voiceChord(ch, 55, 76, 3); const hold = 4 * sec.bars - 0.3;
        push(-0.5, hold + 0.5, 'rock_organ', v[v.length - 1], 0.55, { glide: -12, glideTime: 0.5 });
        for (const n of v.slice(0, -1)) push(0.1, hold, 'rock_organ', n, 0.4);
      }
      // organ slide: a signature of the reference — a smeared rise into the chord, at section starts
      if (barInSection === 0 && ['groove', 'B', 'climax'].includes(S) && rng.chance(0.5)) {
        const top = voiceChord(ch, 64, 79, 1)[0];
        push(-0.5, 1.2, 'rock_organ', top, 0.6, { glide: -12, glideTime: 0.45 });
      }

      // ---- orchestra ----
      if (L.strings) {
        const voicing = voiceChord(ch, 55, 79, 4);
        const changed = b === 0 || chordForBar(b - 1) !== ch || barInSection === 0;
        if (changed) {
          // hold until the next change
          let holdBars = 1; while (holdBars < 4 && chordForBar(b + holdBars) === ch && barInSection + holdBars < sec.bars) holdBars++;
          for (const n of voicing) push(0, 4 * holdBars - 0.1, 'string_ensemble_1', n, S === 'climax' ? 0.7 : 0.5, { swell: S === 'build' });
        }
        if (S === 'climax' && barInSection === sec.bars - 1) { const sc = scaleFor(ch, cue.key); for (let k = 0; k < 4; k++) push(2 + k * 0.5, 0.5, 'string_ensemble_1', scaleStep(voicing[3], sc, k + 1), 0.6); }
      }
      if (L.horns) {
        // long notes: root/fifth low, or a rising call at section starts
        const root = 53 + ((ch.root - 5 + 12) % 12); // F3..E4
        if (barInSection === 0 && S !== 'B') { push(0, 0.5, 'french_horn', root, 0.75); push(0.5, 0.5, 'french_horn', root + 5, 0.8); push(1, 2.5, 'french_horn', root + 7, 0.85); push(1, 2.5, 'french_horn', root, 0.7); }
        else if (S === 'climax') {
          const pat = rng.pick(['x.....x...x.....', 'x.......x.......', 'x..x..x.........']);
          grid(pat, s => { push(slotT(s), 0.45, 'french_horn', root, 0.8); push(slotT(s), 0.45, 'french_horn', root + 7, 0.75); if (rng.chance(0.5)) push(slotT(s), 0.45, 'french_horn', root + 12, 0.65); });
        } else { push(0, 3.9, 'french_horn', root, 0.55); push(0, 3.9, 'french_horn', root + 7, 0.5); }
      }
      if (L.choir) {
        const voicing = voiceChord(ch, 57, 76, 3);
        const changed = chordForBar(b - 1) !== ch || barInSection === 0;
        if (changed) for (const n of voicing) push(0, 3.95, 'choir_aahs', n, 0.6, { swell: true });
      }
      if (L.bassoon) {
        const root = 40 + ((ch.root - 4 + 12) % 12); // E2..Eb3
        const sc = scaleFor(ch, cue.key); const third = ch.q.startsWith('min') ? 3 : 4;
        const pat = rng.pick([[[0, 0], [1, 7], [2, 12], [3, 7]], [[0, 0], [0.5, 12], [1, 7], [2, 0], [2.5, third], [3, 7], [3.5, 12 - 1]]]);
        for (const [t, iv] of pat) push(t, 0.22, 'bassoon', root + iv, 0.8);
        if (secLast) { push(3, 0.2, 'bassoon', root + 12, 0.8); push(3.5, 0.2, 'bassoon', root + 11, 0.8); }
      }
      if (L.pizz) {
        const voicing = voiceChord(ch, 55, 74, 2);
        const pat = S === 'breakdown' ? '..x...x...x...x.' : '..x.......x.....';
        grid(pat, s => { for (const n of voicing) push(slotT(s), 0.2, 'pizzicato_strings', n, 0.7); });
        if (S === 'breakdown' && rng.chance(0.4)) push(3.5, 0.2, 'pizzicato_strings', voicing[0] - 12, 0.6);
      }
      if (L.harp) {
        // arpeggio through the chord, 8ths, spanning two octaves
        const arp = voiceChord(ch, 48, 84, 6);
        for (let s = 0; s < 8; s++) push(s * 0.5, 0.6, 'orchestral_harp', arp[s % arp.length], 0.6);
      }

      // ---- the tune ----
      if (sectionMelody && sectionMelody.events.length) {
        const secBar = barInSection;
        for (const e of sectionMelody.events) {
          if (Math.floor(e.slot / 16) !== secBar) continue;
          const t = (e.slot % 16) / 4; const dur = e.len / 4 - 0.06;
          const extra = {};
          if (e.orn === 'scoop') { extra.glide = -2; extra.glideTime = 0.09; }
          if (e.orn === 'grace') { push(t - 0.09, 0.09, sectionMelody.inst, scaleStep(e.midi, scaleFor(ch, cue.key), -1), e.vel * 0.7); }
          push(t, dur, sectionMelody.inst, e.midi, e.vel, extra);
          if (sectionLead2 && sectionLead2 !== 'none') push(t, dur, sectionLead2, fold(sectionLead2 === 'glockenspiel' ? e.midi + 12 : e.midi, RANGE[sectionLead2]), e.vel * 0.7);
        }
      }

      // ---- section and cue endings ----
      let transition = null;
      if (last) {
        transition = cue.ending;
        if (cue.ending === 'stop') {
          // a final hit on 1: everyone, then silence, then a harp gliss up into the next cue
          const voicing = voiceChord(ch, 55, 79, 4);
          push(0, 0.3, 'kick', null, 1); push(0, 0.3, 'snare', null, 0.9); push(0, 1.5, 'crash', null, 0.7);
          for (const n of voicing) { push(0, 0.35, 'french_horn', n, 0.9); push(0, 0.35, 'string_ensemble_1', n, 0.8); }
          push(0, 0.3, 'electric_bass_finger', 33 + ((ch.bass - 9 + 12) % 12), 1);
          if (cue.triangle) push(0, 2, 'triangle', null, 0.9, { pitch: cue.trianglePitch });
          harpGliss(push, ch, cue.key, 2.5, 1.4, rng);
        } else if (cue.ending === 'slide') {
          harpGliss(push, ch, cue.key, 3.0, 0.9, rng);
        }
      } else if (secLast && ['groove', 'A', 'B', 'build'].includes(S) && rng.chance(0.35)) {
        harpGliss(push, nextCh, cue.key, 3.0, 0.9, rng);
      }

      const out = {
        bar: barsTotal, tempo: cue.tempo, cue: { id: cue.id, keyName: cue.keyName, tempo: cue.tempo, title: cue.title, flavor: cue.flavor, melodyInst: cue.melodyInst, prog: cue.prog.name },
        section: { name: S, index: barInSection, bars: sec.bars }, chord: { root: ch.root, q: ch.q, name: KEY_NAMES[ch.root] + (ch.q === 'min' || ch.q === 'min7' ? 'm' : ch.q === 'dom' ? '7' : '') },
        events: ev, transition, layers: Object.keys(L).filter(k => L[k]),
      };

      // advance
      barsTotal++; barInCue++; barInSection++;
      if (barInSection >= sec.bars) { sectionIdx++; if (sectionIdx >= cue.plan.length) { startCue(); } startSection(); }
      return out;
    }

    function skipCue() { startCue(); startSection(); }
    return { nextBar, skipCue, state, setEnergy: e => { opts.energy = e; } };
  }

  function fold(midi, range) { while (midi > range[1]) midi -= 12; while (midi < range[0]) midi += 12; return midi; }
  function harpGliss(push, ch, key, t0, span, rng) {
    const sc = scaleFor(ch, key); const n = 14; let m = snapTo(52 + ch.root % 12, sc);
    for (let i = 0; i < n; i++) { push(t0 + (span * i) / n, 0.5, 'orchestral_harp', m, 0.35 + 0.5 * i / n); m = scaleStep(m, sc, 1); }
  }
  // choose `count` chord tones between lo and hi, close position, root lowest when count<=3
  function voiceChord(ch, lo, hi, count) {
    const tones = chordTones(ch);
    const out = [];
    let m = lo;
    // start on the chord root at or above lo
    while (((m % 12) + 12) % 12 !== tones[0]) m++;
    let idx = 0;
    while (out.length < count && m <= hi + 12) {
      const t = tones[idx % tones.length];
      while (((m % 12) + 12) % 12 !== t) m++;
      out.push(m); idx++;
    }
    // fold anything above hi down an octave if room
    return out.map(x => (x > hi && x - 12 >= lo ? x - 12 : x)).sort((a, b) => a - b);
  }

  const api = { createRadio, Rng, KEY_NAMES, PROGRESSIONS, RANGE, chordTones, scaleFor, voiceChord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.Composer = api;
})(typeof window !== 'undefined' ? window : globalThis);
