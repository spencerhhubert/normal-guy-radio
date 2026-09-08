// node tools/test-composer.js [seed] [bars] — sanity checks on the composer without any audio.
const C = require('../composer.js');
const seed = parseInt(process.argv[2] || '7', 10), bars = parseInt(process.argv[3] || '400', 10);
const radio = C.createRadio(seed);
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const nn = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
let problems = 0, cues = new Map(), evCount = 0, melodyNotes = 0, melodyChordToneOnStrong = 0, melodyStrong = 0, leaps = 0, steps = 0;
let lastMel = null, sections = [];
for (let i = 0; i < bars; i++) {
  const b = radio.nextBar();
  if (!cues.has(b.cue.id)) { cues.set(b.cue.id, { title: b.cue.title, bars: 0, sections: [] }); }
  const cue = cues.get(b.cue.id); cue.bars++;
  if (b.section.index === 0) cue.sections.push(b.section.name + b.section.bars);
  const tones = C.chordTones({ root: b.chord.root, q: b.chord.q });
  for (const e of b.events) {
    evCount++;
    if (typeof e.t !== 'number' || isNaN(e.t) || typeof e.dur !== 'number' || isNaN(e.dur) || e.dur <= 0) { problems++; console.log('bad time', b.bar, e); }
    if (e.t < -0.6 || e.t >= 4) { problems++; console.log('t out of bar', b.bar, e); }
    if (e.note != null) {
      if (isNaN(e.note)) { problems++; console.log('NaN note', b.bar, e); }
      const r = C.RANGE[e.inst];
      if (r && (e.note < r[0] - 12 || e.note > r[1] + 12)) { problems++; console.log('far out of range', b.bar, e.inst, nn(e.note), e); }
      if (e.inst === b.cue.melodyInst || ['whistle', 'clarinet', 'glockenspiel', 'muted_trumpet'].includes(e.inst)) {
        if (['A', 'B', 'climax'].includes(b.section.name) && e.dur > 0.2) {
          melodyNotes++;
          const strong = Math.abs(e.t - Math.round(e.t)) < 0.01 && Math.round(e.t) % 2 === 0;
          if (strong) { melodyStrong++; if (tones.includes(((e.note % 12) + 12) % 12)) melodyChordToneOnStrong++; }
          if (lastMel != null) { const d = Math.abs(e.note - lastMel); if (d > 4) leaps++; else if (d > 0) steps++; }
          lastMel = e.note;
        }
      }
    }
  }
}
console.log(`seed ${seed}: ${bars} bars, ${cues.size} cues, ${evCount} events (${(evCount / bars).toFixed(1)}/bar), problems: ${problems}`);
console.log(`melody: ${melodyNotes} notes, chord tone on strong beats ${melodyStrong ? Math.round(100 * melodyChordToneOnStrong / melodyStrong) : 0}%, step:leap ${steps}:${leaps}`);
for (const [id, c] of cues) console.log(`  ${c.title} — ${c.bars} bars: ${c.sections.join(' ')}`);
// print the first melody as text
const r2 = C.createRadio(seed); let printed = 0;
for (let i = 0; i < 60 && printed < 8; i++) {
  const b = r2.nextBar();
  if (b.section.name !== 'A') continue;
  const mel = b.events.filter(e => e.inst === b.cue.melodyInst && e.dur > 0.2).sort((a, c) => a.t - c.t);
  if (!mel.length) continue;
  console.log(`  A${b.section.index + 1} ${b.chord.name.padEnd(4)} ` + mel.map(e => `${nn(e.note)}${e.glide ? '~' : ''}@${e.t.toFixed(2)}x${e.dur.toFixed(2)}`).join(' '));
  printed++;
}
process.exit(problems ? 1 : 0);
