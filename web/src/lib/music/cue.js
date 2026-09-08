// One cue: its key, tempo, progression, section plan, and the melodies its sections carry.
import { KEY_NAMES, PROGRESSIONS, MINOR_PROGRESSIONS, MIXO_NAMES, chordTones, scaleFor, snapTo, scaleStep } from './theory.js';
import { KITS, SHAKERS, GUITARS, COMPS, BASS, INTROS, MELODY_RHYTHMS, WALTZ_RHYTHMS, LIFT, RANGE } from './style.js';

function makePlan(rng, kind) {
  const plan = [{ name: 'intro', bars: rng.pick([2, 4]) }];
  if (kind === 'mellow') {
    plan.push({ name: 'A', bars: 8 }, { name: 'B', bars: 8 });
    if (rng.chance(0.7)) plan.push({ name: 'breakdown', bars: rng.pick([4, 8]) });
    plan.push({ name: 'A', bars: 8 });
    if (rng.chance(0.3)) plan.push({ name: 'climax', bars: 8 });
  } else {
    plan.push({ name: 'groove', bars: 4 }, { name: 'A', bars: 8 });
    if (kind === 'big' || rng.chance(0.6)) plan.push({ name: 'build', bars: 4 });
    plan.push({ name: 'B', bars: 8 });
    if (rng.chance(kind === 'big' ? 0.4 : 0.6)) plan.push({ name: 'breakdown', bars: rng.pick([4, 8]) });
    if (kind === 'big' || rng.chance(0.8)) plan.push({ name: 'climax', bars: 8 });
  }
  plan.push({ name: 'outro', bars: 1 });
  return plan;
}

export function makeCue(rng, id, prev, P) {
  let key;
  do { key = rng.weighted([[7, 5], [0, 4], [2, 4], [5, 3], [9, 3], [10, 2], [4, 2], [3, 1], [11, 1]]); } while (prev && key === prev.key && rng.chance(0.8));
  const tempo = Math.round(rng.range(P.tempo[0], P.tempo[1]));
  const pool = P.mode === 'minor' ? MINOR_PROGRESSIONS : P.mode === 'mixo' ? PROGRESSIONS.filter(p => MIXO_NAMES.includes(p.name)) : PROGRESSIONS;
  const prog = rng.weighted(pool.map(p => [p, p.w]));
  const chords = prog.bars.map(b => ({ root: (b[0] + key) % 12, q: b[1], bass: b.length > 2 ? (b[2] + key) % 12 : (b[0] + key) % 12 }));
  const plan = makePlan(rng, P.plan), kit = KITS[P.kit], melodyInst = rng.weighted(P.melody);
  return {
    id, key, keyName: KEY_NAMES[key], tempo, beats: P.beats, slots: P.beats * 4, prog, chords, flavor: rng.weighted(P.flavors), plan, total: plan.reduce((s, p) => s + p.bars, 0),
    groove: P.groove, mode: P.mode, swing: P.swing, kit: P.kit, orchestra: P.orchestra, useGuitar: P.guitar, oompah: P.bass[0] === 'tuba',
    melodyInst, melody2: melodyInst === P.melody[0][0] ? P.melody[1][0] : P.melody[0][0],
    compInst: P.comp, compPat: P.compPat, pad: ['funk', 'lazy', 'bossa', 'pad'].includes(P.compPat), compHits: rng.pick(COMPS[P.compPat]) || null,
    bassPat: BASS[rng.pick(P.bass)] || null,
    drums: kit ? { kick: rng.pick(kit.kick), snare: rng.pick(kit.snare), hat: kit.hat.length ? rng.pick(kit.hat) : null } : null,
    shaker: P.shaker ? rng.pick(SHAKERS[P.shaker]) : null, guitarPat: rng.pick(GUITARS[P.groove] || GUITARS.funk),
    ending: rng.weighted([['stop', 4], ['fill', 3], ['slide', 2]]),
    organPad: rng.chance(0.6),
    introStyle: rng.weighted(INTROS[P.groove]),
    afterFill: !!(prev && prev.ending === 'fill'),
    triangle: rng.chance(0.5), trianglePattern: rng.weighted([['downbeat', 3], ['offbeat', 2], ['sparse', 2]]), trianglePitch: rng.range(0.82, 1.18),
    introDing: rng.chance(0.2),
  };
}

export function generateMelody(rng, cue, inst, sectionBars, chordAt, lift) {
  const [lo, hi] = RANGE[inst], slots = cue.slots, strongEvery = cue.beats === 3 ? 12 : 8;
  const center = Math.round((lo + hi) / 2) + lift + (LIFT[inst] || 0);
  const events = [];
  const phrases = sectionBars / 2, pool = cue.beats === 3 ? WALTZ_RHYTHMS : MELODY_RHYTHMS;
  const rhythmA = rng.pick(pool), rhythmB = rng.pick(pool);
  function makePhrase(rhythm, startSlot, seedPitch, contourSign, finalHold) {
    const out = [];
    let slot = startSlot, pitch = seedPitch, dir = contourSign, prevLeap = 0, idx = 0;
    const notesOnly = rhythm.filter(x => x > 0).length;
    for (const r of rhythm) {
      if (r < 0) { slot += -r; continue; }
      const ch = chordAt(slot), scale = scaleFor(ch, cue.key, cue.mode), tones = chordTones(ch);
      const strong = (slot % strongEvery) === 0 || idx === notesOnly - 1;
      if (idx === 0) pitch = snapTo(pitch, tones);
      else {
        let move;
        if (prevLeap !== 0) { move = -Math.sign(prevLeap); prevLeap = 0; }
        else {
          const x = rng.f();
          if (x < 0.14) move = 0; else if (x < 0.74) move = dir; else if (x < 0.92) move = dir * 2; else move = dir * (rng.chance(0.6) ? 3 : 4);
          if (rng.chance(0.28)) dir = -dir;
        }
        if (Math.abs(move) >= 3) prevLeap = move;
        pitch = scaleStep(pitch, scale, move);
        if (strong) pitch = snapTo(pitch, tones);
      }
      if (pitch > hi) { pitch = scaleStep(pitch, scale, -rng.int(3, 5)); dir = -1; }
      if (pitch < lo) { pitch = scaleStep(pitch, scale, rng.int(3, 5)); dir = 1; }
      if (idx === notesOnly - 1 && finalHold) pitch = snapTo(pitch, tones.slice(0, 3));
      let orn = null;
      if (r >= 8 && rng.chance(0.35)) orn = 'scoop'; else if (r >= 4 && rng.chance(0.12)) orn = 'grace';
      out.push({ slot, len: r, midi: pitch, orn, vel: (strong ? 0.9 : 0.75) + rng.range(-0.08, 0.08) });
      slot += r; idx++;
    }
    return out;
  }
  const A = makePhrase(rhythmA, 0, snapTo(center + rng.int(-3, 3), chordTones(chordAt(0))), rng.chance(0.55) ? 1 : -1, false);
  for (let p = 0; p < phrases; p++) {
    const start = p * 2 * slots, kind = ['A', 'A2', 'B', 'A3'][p % 4];
    if (kind === 'A') { events.push(...A); continue; }
    if (kind === 'B') {
      const bseed = snapTo(A[0].midi + (rng.chance(0.5) ? 5 : -4), chordTones(chordAt(start)));
      events.push(...makePhrase(rhythmB, start, bseed, A[A.length - 1].midi >= A[0].midi ? -1 : 1, true));
      continue;
    }
    for (let i = 0; i < A.length; i++) {
      const e = A[i], slot = start + e.slot, ch = chordAt(slot), scale = scaleFor(ch, cue.key, cue.mode), tones = chordTones(ch);
      const last = i === A.length - 1, strong = (slot % strongEvery) === 0 || last;
      let midi = e.midi, len = e.len;
      if (kind === 'A3' && last) { midi = snapTo(midi, [cue.key, (cue.key + (cue.mode === 'minor' ? 3 : 4)) % 12, (cue.key + 7) % 12]); len = Math.max(len, 12); }
      else if (strong) midi = snapTo(midi, tones);
      else if (!scale.includes(((midi % 12) + 12) % 12)) midi = snapTo(midi, scale);
      if (kind === 'A2' && i > 0 && rng.chance(0.25)) midi = scaleStep(midi, scale, rng.pick([-1, 1]));
      events.push({ slot, len, midi, orn: e.orn, vel: e.vel });
    }
  }
  return events.filter(e => e.slot < sectionBars * slots);
}
