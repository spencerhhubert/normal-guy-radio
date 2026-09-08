// Keys, chords, scales and voicings.
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10] };
export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], dom: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], maj6: [0, 4, 7, 9] };
export const PROGRESSIONS = [
  { name: 'vamp', w: 5, bars: [[0, 'maj'], [0, 'maj'], [0, 'maj'], [0, 'maj']] },
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
export const MINOR_PROGRESSIONS = [
  { name: 'i bVII bVI bVII', w: 4, bars: [[0, 'min'], [10, 'maj'], [8, 'maj'], [10, 'maj']] },
  { name: 'i bVI bIII bVII', w: 3, bars: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
  { name: 'i iv i V', w: 2, bars: [[0, 'min'], [5, 'min'], [0, 'min'], [7, 'dom']] },
  { name: 'i bVII (vamp)', w: 3, bars: [[0, 'min'], [10, 'maj'], [0, 'min'], [10, 'maj']] },
  { name: 'i bIII bVII IV', w: 2, bars: [[0, 'min'], [3, 'maj'], [10, 'maj'], [5, 'maj']] },
  { name: 'i (vamp)', w: 3, bars: [[0, 'min7'], [0, 'min7'], [0, 'min7'], [0, 'min7']] },
];
export const MIXO_NAMES = ['vamp', 'I bVII IV I', 'I bVII (vamp)', 'I IV/I', 'I bIII IV I', 'I IV I V', 'I IV (8)'];

export function chordTones(ch) { return QUAL[ch.q].map(x => (x + ch.root) % 12); }
export function scaleFor(ch, key, mode = 'major') {
  const sc = SCALES[mode].map(x => (x + key) % 12);
  for (const t of chordTones(ch)) {
    if (sc.includes(t)) continue;
    let best = -1, bd = 99;
    for (let i = 0; i < sc.length; i++) { const d = Math.min((sc[i] - t + 12) % 12, (t - sc[i] + 12) % 12); if (d < bd) { bd = d; best = i; } }
    sc[best] = t;
  }
  return sc.sort((a, b) => a - b);
}
export function snapTo(midi, set) {
  const pc = ((midi % 12) + 12) % 12;
  let best = 0, bd = 99;
  for (const s of set) { const d = ((s - pc) % 12 + 18) % 12 - 6; if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; } }
  return midi + best;
}
export function scaleStep(midi, scale, steps) {
  let m = snapTo(midi, scale);
  const dir = steps > 0 ? 1 : -1;
  for (let k = 0; k < Math.abs(steps); k++) { let n = m + dir; while (!scale.includes(((n % 12) + 12) % 12)) n += dir; m = n; }
  return m;
}
export function voiceChord(ch, lo, hi, count) {
  const tones = chordTones(ch), out = [];
  let m = lo, idx = 0;
  while (((m % 12) + 12) % 12 !== tones[0]) m++;
  while (out.length < count && m <= hi + 12) { const t = tones[idx % tones.length]; while (((m % 12) + 12) % 12 !== t) m++; out.push(m); idx++; }
  return out.map(x => (x > hi && x - 12 >= lo ? x - 12 : x)).sort((a, b) => a - b);
}
export function fold(midi, range) { while (midi > range[1]) midi -= 12; while (midi < range[0]) midi += 12; return midi; }
