// The arrangement: an endless run of cues from one seed, written out one bar of events at a time.
import { Rng } from './rng.js';
import { KEY_NAMES, chordTones, scaleFor, snapTo, scaleStep, voiceChord, fold } from './theory.js';
import { KITS, BASS, RANGE, SOFT, DEFAULT_PROFILE } from './style.js';
import { makeCue, generateMelody } from './cue.js';

function harpGliss(push, ch, key, mode, t0, span) {
  const sc = scaleFor(ch, key, mode), n = 14;
  let m = snapTo(52 + ch.root % 12, sc);
  for (let i = 0; i < n; i++) { push(t0 + (span * i) / n, 0.5, 'orchestral_harp', m, 0.35 + 0.5 * i / n); m = scaleStep(m, sc, 1); }
}

// One radio: an endless run of cues from one seed. With a deadline (seconds) it wraps up before it:
// the cue in progress jumps to its outro, and the leftover is one silent bar.
export function createRadio(seed, deadline = Infinity, profile = DEFAULT_PROFILE) {
  const rng = new Rng(seed || 1);
  let cueCount = 0, cue = null, prevCue = null, barInCue = 0, sectionIdx = 0, barInSection = 0, elapsed = 0, done = false;
  let melody = null, lead2 = null;

  const chordForBar = b => cue.chords[((b % cue.chords.length) + cue.chords.length) % cue.chords.length];
  function startCue() { prevCue = cue; cue = makeCue(rng, ++cueCount, prevCue, profile); barInCue = 0; sectionIdx = 0; }
  function startSection() {
    const sec = cue.plan[sectionIdx];
    barInSection = 0; melody = null; lead2 = null;
    const secStart = barInCue, chordAt = slot => chordForBar(secStart + Math.floor(slot / 16));
    if (['A', 'B', 'climax'].includes(sec.name)) {
      const inst = sec.name === 'B' && rng.chance(0.4) ? cue.melody2 : cue.melodyInst;
      melody = { inst, events: generateMelody(rng, cue, inst, sec.bars, chordAt, sec.name === 'climax' ? 2 : 0) };
      if (sec.name === 'climax') lead2 = rng.weighted([['string_ensemble_1', 3], ['glockenspiel', 2], ['clarinet', 1], ['none', 1]]);
    }
    if (sec.name === 'intro' && cue.introStyle === 'solo') melody = { inst: cue.melodyInst, events: generateMelody(rng, cue, cue.melodyInst, sec.bars, chordAt, 0) };
    if (sec.name === 'breakdown') {
      const style = cue.flavor === 'sweet' ? 'harp' : rng.weighted([['duet', 3], ['harp', 1.5], ['pizz', 1.5]]);
      melody = { inst: 'clarinet', style, events: style === 'duet' ? generateMelody(rng, cue, 'clarinet', sec.bars, chordAt, 0) : [] };
    }
  }

  function nextBar() {
    if (done) return null;
    if (!cue) { startCue(); startSection(); }
    let sec = cue.plan[sectionIdx];
    const barDur = (60 * cue.beats) / cue.tempo, remaining = deadline - elapsed;
    if (remaining < barDur * 0.999) { done = true; return { silent: true, dur: remaining, events: [], tempo: cue.tempo, cue: cueInfo(), section: { name: 'off', index: 0, bars: 1 }, chord: chordName(chordForBar(barInCue)), layers: [] }; }
    if (sec.name !== 'outro' && remaining < barDur * 2.5) { sectionIdx = cue.plan.length - 1; barInCue = cue.total - 1; startSection(); sec = cue.plan[sectionIdx]; }

    const ev = [], b = barInCue, ch = chordForBar(b), nextCh = chordForBar(b + 1);
    const last = barInCue === cue.total - 1, secLast = barInSection === sec.bars - 1, S = sec.name, flavor = cue.flavor;
    // swing pushes the offbeat eighths toward a triplet feel; nothing starts past the bar line
    const push = (t, dur, inst, note, vel, extra) => { if (t < cue.beats) ev.push(Object.assign({ t: t + (cue.swing && Math.abs(t - Math.floor(t) - 0.5) < 0.01 ? cue.swing * 0.167 : 0), dur, inst, note, vel }, extra || {})); };
    const slotT = s => s / 4;
    const grid = (pat, fn) => { for (let s = 0; s < Math.min(pat.length, cue.slots); s++) if (pat[s] !== '.') fn(s, pat[s]); };
    const rhythmSec = ['groove', 'A', 'build', 'B', 'climax'].includes(S);

    const L = {
      shaker: !!cue.shaker && (S !== 'outro' || cue.ending !== 'stop'),
      triangle: cue.triangle,
      bass: !!cue.bassPat && S !== 'outro',
      drums: !!cue.drums && (rhythmSec || (S === 'outro' && cue.ending === 'fill')),
      guitar: cue.useGuitar && rhythmSec && flavor !== 'sweet',
      comp: rhythmSec && cue.compInst !== 'none',
      organStab: ['build', 'climax'].includes(S) && cue.compInst !== 'rock_organ' && !['waltz', 'lounge'].includes(cue.groove),
      strings: cue.orchestra !== 'none' && (['build', 'B', 'climax'].includes(S) || (S === 'breakdown' && melody && melody.style === 'harp')),
      horns: cue.orchestra === 'full' && (['build', 'climax'].includes(S) || (S === 'B' && flavor === 'caper')),
      choir: cue.orchestra === 'full' && S === 'climax',
      tuba: cue.oompah ? rhythmSec : (S === 'breakdown' && melody && melody.style === 'duet') || (flavor === 'goofy' && S === 'B'),
      bassoon: cue.oompah ? rhythmSec : (S === 'breakdown' && melody && melody.style === 'duet') || (flavor === 'goofy' && ['B', 'climax'].includes(S)),
      pizz: (S === 'breakdown' && melody && melody.style === 'pizz') || (flavor === 'caper' && ['A', 'B'].includes(S)),
      harp: S === 'breakdown' && melody && melody.style === 'harp',
      organHold: false,
    };
    if (S === 'intro') {
      const st = cue.introStyle;
      L.bass = !!cue.bassPat && (st === 'vamp' || (st === 'slide' && barInSection >= 1) || (st === 'harp' && secLast) || cue.afterFill);
      L.drums = !!cue.drums && (cue.afterFill || (st === 'slide' ? secLast : (st === 'vamp' && barInSection >= 2 && rng.chance(0.5))));
      L.comp = st === 'vamp' && cue.compInst !== 'none' && (barInSection >= 1 || cue.afterFill);
      L.strings = st === 'solo' || st === 'harp';
      L.harp = st === 'harp';
      L.tuba = st === 'oompah'; L.bassoon = st === 'oompah';
      L.shaker = !!cue.shaker && (st !== 'solo' || cue.afterFill);
      L.organHold = st === 'slide';
      L.guitar = cue.afterFill && st === 'vamp';
    }
    if (L.tuba) L.bass = false;
    if (S === 'breakdown') { L.drums = false; L.guitar = false; L.comp = false; }
    if (S === 'outro' && cue.ending === 'stop') { L.bass = false; L.guitar = false; L.comp = false; L.drums = false; }

    if (L.shaker) grid(cue.shaker, (s, c) => push(slotT(s), 0.2, 'shaker', null, (c === 'X' ? 0.9 : 0.5) * (S === 'breakdown' ? 0.7 : 1)));
    if (L.triangle) {
      const tp = { pitch: cue.trianglePitch };
      if (cue.trianglePattern === 'downbeat') { if (b % 2 === 0 && rng.chance(0.85)) push(0, 1.5, 'triangle', null, 0.7, tp); }
      else if (cue.trianglePattern === 'offbeat') { if (rng.chance(0.8)) push(cue.beats - 0.5, 1.2, 'triangle', null, 0.6, tp); }
      else if (b % 4 === 0) push(0, 1.5, 'triangle', null, 0.7, tp);
      if (rng.chance(0.25)) push(rng.pick([1.5, 2.5]), 0.3, 'triangle', null, 0.4, Object.assign({ muted: true }, tp));
      if (S === 'intro' && barInSection === 0 && cue.introDing) push(0, 2, 'triangle', null, 0.9, tp);
    }
    if (L.drums) {
      const K = KITS[cue.kit], [lk, ls, lh] = K.level || [1, 1, 1], n = cue.slots;
      const fill = K.fills && ((secLast && rng.chance(0.6) && S !== 'outro') || (S === 'outro' && cue.ending === 'fill'));
      const hatP = S === 'climax' && cue.kit === 'full' && rng.chance(0.5) ? 'xxxxxxxxxxxxxxxx' : cue.drums.hat;
      grid(cue.drums.kick, s => push(slotT(s), 0.3, 'kick', null, 0.95 * lk));
      grid(cue.drums.snare, (s, c) => push(slotT(s), 0.3, 'snare', null, (c === 'g' ? 0.3 : c === 'm' ? 0.55 : 0.9) * ls));
      if (hatP && lh) grid(hatP, (s, c) => push(slotT(s), c === 'o' ? 0.6 : 0.08, 'hat', null, (c === 'X' ? 0.75 : c === 'o' ? 0.6 : (s % 2 ? 0.35 : 0.55)) * lh, c === 'o' ? { open: true } : null));
      if (fill) {
        const start = n - rng.pick([4, 6, 8]);
        for (let s = start; s < n; s++) push(slotT(s), 0.2, 'snare', null, 0.45 + 0.5 * (s - start) / (n - start));
        if (rng.chance(0.5)) push(cue.beats - 0.25, 0.2, 'kick', null, 0.8);
      }
      if (barInSection === 0 && ['A', 'climax'].includes(S) && lk >= 0.85) push(0, 1.5, 'crash', null, S === 'climax' ? 0.8 : 0.5);
      if (S === 'outro' && cue.ending === 'fill') push(cue.beats - 0.25, 0.2, 'kick', null, 0.9);
    }
    if (L.bass) {
      const base = 33 + ((ch.bass - 9 + 12) % 12), nbase = 33 + ((nextCh.bass - 9 + 12) % 12);
      let pat = cue.bassPat;
      if (S === 'intro' || S === 'breakdown') pat = cue.beats === 3 ? BASS.waltz2 : BASS.ref;
      if (secLast && cue.beats === 4 && cue.groove !== 'lounge' && rng.chance(0.5) && S !== 'outro') pat = BASS.walk;
      const third = ch.q.startsWith('min') ? 3 : 4;
      for (const [s, len, what] of pat) {
        let n = base;
        if (what === '5') n = base + 7; else if (what === 'o') n = base + 12; else if (what === '3') n = base + third; else if (what === '6') n = base + 9;
        else if (what === 'w1') n = nbase - 1; else if (what === 'w2') n = nbase + (rng.chance(0.5) ? 1 : -2);
        if (n > 50) n -= 12; if (n < 31) n += 12;
        push(slotT(s), Math.max(0.2, len / 4 - 0.05), 'electric_bass_finger', n, what === 'r' && s === 0 ? 0.95 : 0.8);
      }
    }
    if (L.tuba) {
      const base = 29 + ((ch.bass - 5 + 12) % 12);
      if (cue.beats === 3) { push(0, 0.5, 'tuba', base, 0.9); if (secLast) push(2, 0.4, 'tuba', base + 7, 0.8); }
      else { push(0, 0.45, 'tuba', base, 0.9); push(2, 0.45, 'tuba', base + (rng.chance(0.7) ? 7 : 5), 0.85); if (secLast) { push(3, 0.3, 'tuba', base + 4, 0.8); push(3.5, 0.3, 'tuba', base + 5, 0.8); } }
    }
    if (L.guitar) {
      const voicing = voiceChord(ch, 55, 76, 3);
      grid(cue.guitarPat, s => { for (const n of voicing) push(slotT(s) + 0.005, 0.16, 'electric_guitar_muted', n, s % 4 === 0 ? 0.7 : s % 2 ? 0.38 : 0.55); });
      if (rng.chance(0.15)) push(3.5, 0.12, 'electric_guitar_muted', voicing[0] - 12, 0.5);
    }
    if (L.comp) {
      const inst = cue.compInst, B = cue.beats;
      const voicing = voiceChord(ch, inst === 'rock_organ' ? 55 : 60, inst === 'rock_organ' ? 76 : 79, ch.q.length > 3 ? 4 : 3);
      if (cue.pad || S === 'intro') for (const n of voiceChord(ch, 55, 74, 3)) push(0, B - 0.15, 'electric_piano_1', n, S === 'intro' ? 0.4 : 0.5);
      if (cue.pad && inst !== 'rock_organ' && S !== 'intro' && cue.organPad) for (const n of voiceChord(ch, 55, 74, 3)) push(0, B - 0.1, 'rock_organ', n, 0.35);
      if (S !== 'intro' && cue.compHits) grid(cue.compHits, s => { for (const n of voicing) push(slotT(s), inst === 'rock_organ' ? 0.4 : cue.compPat === 'stab' ? 0.3 : 0.9, inst, n, 0.65); });
      if (rng.chance(0.12) && S !== 'intro') { const sc = scaleFor(ch, cue.key, cue.mode), a = voicing[voicing.length - 1]; push(3.5, 0.2, inst, scaleStep(a, sc, 1), 0.5); push(3.75, 0.2, inst, scaleStep(a, sc, 2), 0.5); }
    }
    if (L.organStab && barInSection % 2 === 1) {
      const voicing = voiceChord(ch, 60, 79, 3);
      for (const n of voicing) push(1.5, 0.25, 'rock_organ', n, 0.55);
      if (rng.chance(0.5)) for (const n of voicing) push(3.5, 0.25, 'rock_organ', n, 0.5);
    }
    if (L.organHold && barInSection === 0) {
      const v = voiceChord(ch, 55, 76, 3), hold = cue.beats * sec.bars - 0.3;
      push(-0.5, hold + 0.5, 'rock_organ', v[v.length - 1], 0.55, { glide: -12, glideTime: 0.5 });
      for (const n of v.slice(0, -1)) push(0.1, hold, 'rock_organ', n, 0.4);
    }
    if (barInSection === 0 && ['groove', 'B', 'climax'].includes(S) && rng.chance(0.5)) push(-0.5, 1.2, 'rock_organ', voiceChord(ch, 64, 79, 1)[0], 0.6, { glide: -12, glideTime: 0.45 });

    if (L.strings) {
      const voicing = voiceChord(ch, 55, 79, 4);
      if (b === 0 || chordForBar(b - 1) !== ch || barInSection === 0) {
        let hold = 1; while (hold < 4 && chordForBar(b + hold) === ch && barInSection + hold < sec.bars) hold++;
        for (const n of voicing) push(0, cue.beats * hold - 0.1, 'string_ensemble_1', n, S === 'climax' ? 0.7 : 0.5, { swell: S === 'build' });
      }
      if (S === 'climax' && secLast) { const sc = scaleFor(ch, cue.key, cue.mode); for (let k = 0; k < 4; k++) push(cue.beats - 2 + k * 0.5, 0.5, 'string_ensemble_1', scaleStep(voicing[3], sc, k + 1), 0.6); }
    }
    if (L.horns) {
      const root = 53 + ((ch.root - 5 + 12) % 12);
      if (barInSection === 0 && S !== 'B') { push(0, 0.5, 'french_horn', root, 0.75); push(0.5, 0.5, 'french_horn', root + 5, 0.8); push(1, 2.5, 'french_horn', root + 7, 0.85); push(1, 2.5, 'french_horn', root, 0.7); }
      else if (S === 'climax') {
        grid(rng.pick(['x.....x...x.....', 'x.......x.......', 'x..x..x.........']), s => { push(slotT(s), 0.45, 'french_horn', root, 0.8); push(slotT(s), 0.45, 'french_horn', root + 7, 0.75); if (rng.chance(0.5)) push(slotT(s), 0.45, 'french_horn', root + 12, 0.65); });
      } else { push(0, cue.beats - 0.1, 'french_horn', root, 0.55); push(0, cue.beats - 0.1, 'french_horn', root + 7, 0.5); }
    }
    if (L.choir && (chordForBar(b - 1) !== ch || barInSection === 0)) for (const n of voiceChord(ch, 57, 76, 3)) push(0, cue.beats - 0.05, 'choir_aahs', n, 0.6, { swell: true });
    if (L.bassoon) {
      const root = 40 + ((ch.root - 4 + 12) % 12), third = ch.q.startsWith('min') ? 3 : 4;
      const hits = L.tuba ? (cue.beats === 3 ? [[1, 7], [2, 7]] : [[1, 7], [3, rng.chance(0.3) ? third + 12 : 7]]) : rng.pick([[[0, 0], [1, 7], [2, 12], [3, 7]], [[0, 0], [0.5, 12], [1, 7], [2, 0], [2.5, third], [3, 7], [3.5, 11]]]);
      for (const [t, iv] of hits) push(t, 0.22, 'bassoon', root + iv, 0.8);
      if (secLast) { push(cue.beats - 1, 0.2, 'bassoon', root + 12, 0.8); push(cue.beats - 0.5, 0.2, 'bassoon', root + 11, 0.8); }
    }
    if (L.pizz) {
      const voicing = voiceChord(ch, 55, 74, 2);
      grid(S === 'breakdown' ? '..x...x...x...x.' : '..x.......x.....', s => { for (const n of voicing) push(slotT(s), 0.2, 'pizzicato_strings', n, 0.7); });
      if (S === 'breakdown' && rng.chance(0.4)) push(3.5, 0.2, 'pizzicato_strings', voicing[0] - 12, 0.6);
    }
    if (L.harp) { const arp = voiceChord(ch, 48, 84, 6); for (let s = 0; s < cue.beats * 2; s++) push(s * 0.5, 0.6, 'orchestral_harp', arp[s % arp.length], 0.6); }

    if (melody && melody.events.length) {
      for (const e of melody.events) {
        if (Math.floor(e.slot / cue.slots) !== barInSection) continue;
        const t = (e.slot % cue.slots) / 4, dur = e.len / 4 - 0.06, extra = {}, vel = e.vel * (SOFT[melody.inst] || 1);
        if (e.orn === 'scoop') { extra.glide = -2; extra.glideTime = 0.09; }
        if (e.orn === 'grace') push(t - 0.09, 0.09, melody.inst, scaleStep(e.midi, scaleFor(ch, cue.key, cue.mode), -1), vel * 0.7);
        push(t, dur, melody.inst, e.midi, vel, extra);
        if (lead2 && lead2 !== 'none') push(t, dur, lead2, fold(lead2 === 'glockenspiel' ? e.midi + 12 : e.midi, RANGE[lead2]), vel * 0.7);
      }
    }

    if (last) {
      if (cue.ending === 'stop') {
        push(0, 0.3, 'kick', null, 1); push(0, 0.3, 'snare', null, 0.9); push(0, 1.5, 'crash', null, 0.7);
        for (const n of voiceChord(ch, 55, 79, 4)) { push(0, 0.35, 'french_horn', n, 0.9); push(0, 0.35, 'string_ensemble_1', n, 0.8); }
        push(0, 0.3, 'electric_bass_finger', 33 + ((ch.bass - 9 + 12) % 12), 1);
        if (cue.triangle) push(0, 2, 'triangle', null, 0.9, { pitch: cue.trianglePitch });
        harpGliss(push, ch, cue.key, cue.mode, cue.beats - 1.5, 1.4);
      } else if (cue.ending === 'slide') harpGliss(push, ch, cue.key, cue.mode, cue.beats - 1, 0.9);
    } else if (secLast && ['groove', 'A', 'B', 'build'].includes(S) && rng.chance(0.35)) harpGliss(push, nextCh, cue.key, cue.mode, cue.beats - 1, 0.9);

    const out = { dur: barDur, tempo: cue.tempo, beats: cue.beats, cue: cueInfo(), section: { name: S, index: barInSection, bars: sec.bars }, chord: chordName(ch), events: ev, layers: Object.keys(L).filter(k => L[k]) };
    elapsed += barDur; barInCue++; barInSection++;
    if (barInSection >= sec.bars) { sectionIdx++; if (sectionIdx >= cue.plan.length) startCue(); startSection(); }
    return out;
  }
  function cueInfo() { return { id: cue.id, keyName: cue.keyName + (cue.mode === 'minor' ? 'm' : ''), tempo: cue.tempo, groove: cue.groove, flavor: cue.flavor, melodyInst: cue.melodyInst, prog: cue.prog.name }; }
  function chordName(ch) { return KEY_NAMES[ch.root] + (ch.q.startsWith('min') ? 'm' : ch.q === 'dom' ? '7' : ''); }
  return { nextBar };
}
