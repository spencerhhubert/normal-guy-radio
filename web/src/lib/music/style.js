// The sound of a station: grooves, kits, patterns, ranges, and the personality a frequency gets.
import { Rng, hash32 } from './rng.js';

// snare: x hit, m medium, g ghost; hat: x closed, X accent, o open
export const KITS = {
  full: { fills: true, kick: ['x.......x.......', 'x......x..x.....', 'x..x....x..x....', 'x.....x...x.....', 'x......x.x......', 'x..x......x.....', 'x.......x.x.....'], snare: ['....x.......x...', '....x.......x..g', '....x..g....x...', '....x.......x.g.', 'g...x.......x...'], hat: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.o.', 'X.x.X.x.X.x.X.x.', 'xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx', 'x.x.x.xxx.x.x.x.'] },
  light: { level: [0.75, 0.65, 0], kick: ['x.......x.......'], snare: ['....x.......x...'], hat: [] },
  brush: { level: [0.6, 0.6, 0.45], kick: ['x...............', 'x.......x.......'], snare: ['..g.x...g.g.x...', 'g.g.x.g.g.g.x.g.'], hat: ['x.x.x.x.x.x.x.x.'] },
  half: { fills: true, kick: ['x.........x.....', 'x......x........', 'x..x......x.....', 'x.........x..x..'], snare: ['........x.......', '........x......g', '.......gx.......'], hat: ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.x.', 'x.x.x.xxx.x.x.x.'] },
  bossa: { level: [0.85, 0.9, 0.8], kick: ['x..x..x.x..x..x.', 'x.....x.x.....x.'], snare: ['..g..g...g..g...', 'g..g..g...g..g..'], hat: ['x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'] },
  shuffle: { fills: true, kick: ['x.......x.......', 'x.....x.x.......', 'x..x....x..x....'], snare: ['....x.......x...', '....x..g....x..g'], hat: ['x.x.x.x.x.x.x.x.', 'x.x.x.o.x.x.x.o.'] },
  four: { fills: true, kick: ['x...x...x...x...'], snare: ['....x.......x...', '....x.......x..g', '....x...g...x...'], hat: ['x.o.x.o.x.o.x.o.', '..o...o...o...o.', 'xxoxxxoxxxoxxxox'] },
  march: { fills: true, level: [0.9, 0.85, 0], kick: ['x...x...x...x...', 'x.......x.......', 'x...x...x.x.x...'], snare: ['m.m.x.m.m.m.x.m.', 'g.g.x.g.g.g.x.g.', 'mmm.x.m.mmm.x.m.'], hat: [] },
  waltz: { level: [0.7, 0.55, 0.6], kick: ['x...........', 'x.......x...'], snare: ['....g...g...', '....x...x...'], hat: ['....x...x...', 'x...x...x...'] },
};
export const SHAKERS = { 1: ['xXxxxXxxxXxxxXxx', 'XxxxXxxxXxxxXxxx', 'xxXxxxXxxxXxxxXx'], 2: ['xXxXxXxXxXxXxXxX', 'XxxxXxxxXxxxXxxx'] };
export const GUITARS = {
  funk: ['x.xx.x.xx.xx.x.x', 'x.xxx.xxx.xxx.xx', 'xx.xxx.xxx.xxx.x', 'x.x.xxx.x.x.xxx.', 'x.xx.xx.x.xx.xx.', 'xxxxxxxxxxxxxxxx', 'x..xx.xxx..xx.xx'],
  disco: ['x.xx.x.xx.xx.x.x', 'xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.'], bossa: ['x..x..x...x..x..', '..x..x.x..x..x.x'], lazy: ['x.x.x.x.x.x.x.x.', 'x...x...x...x...'], shuffle: ['x.x.x.x.x.x.x.x.', 'x...x...x...x...'],
};
export const COMPS = {
  funk: ['......x.......x.', 'x.........x.....', '......x...x.....', 'x.....x.......x.', '..x.......x.....', 'x...............'],
  pad: [], lazy: ['x.......x.......', 'x.........x.....', 'x...............'], bossa: ['..x..x....x..x..', '..x...x...x..x..', 'x..x..x...x..x..'],
  shuffle: ['x.x.x.x.x.x.x.x.', '....x.......x...', 'x...x...x...x...'], stab: ['....x.......x...', 'x..x..x...x..x..', '......x.......x.'], offbeat: ['..x...x...x...x.'], waltz: ['....x...x...', '....x.x.x...'],
};
export const BASS = {
  ref: [[0, 12, 'r'], [12, 4, '5']], ref2: [[0, 6, 'r'], [6, 2, 'r'], [8, 4, 'r'], [12, 4, '5']],
  funk: [[0, 2, 'r'], [3, 1, 'r'], [4, 2, 'r'], [8, 2, 'r'], [10, 2, '5'], [12, 2, 'r'], [14, 2, 'w1']],
  walk: [[0, 4, 'r'], [4, 4, 'r'], [8, 4, '5'], [12, 2, 'w2'], [14, 2, 'w1']],
  sync: [[0, 3, 'r'], [3, 3, 'r'], [6, 2, '5'], [8, 4, 'r'], [12, 2, 'r'], [14, 2, 'o']],
  oct: [[0, 2, 'r'], [2, 2, 'o'], [4, 4, 'r'], [8, 2, 'r'], [10, 2, 'o'], [12, 2, '5'], [14, 2, 'w1']],
  long: [[0, 8, 'r'], [8, 4, 'r'], [12, 4, '5']], pop: [[0, 2, 'r'], [3, 3, 'r'], [6, 2, 'o'], [8, 2, 'r'], [11, 3, '5'], [14, 2, 'w1']],
  bossa: [[0, 6, 'r'], [6, 2, '5'], [8, 6, 'r'], [14, 2, '5']],
  disco: [[0, 2, 'r'], [2, 2, 'o'], [4, 2, 'r'], [6, 2, 'o'], [8, 2, 'r'], [10, 2, 'o'], [12, 2, 'r'], [14, 2, 'o']],
  boogie: [[0, 2, 'r'], [2, 2, '3'], [4, 2, '5'], [6, 2, '6'], [8, 2, 'o'], [10, 2, '6'], [12, 2, '5'], [14, 2, '3']],
  waltz: [[0, 4, 'r'], [4, 4, '5'], [8, 4, '5']], waltz2: [[0, 8, 'r'], [8, 4, '5']],
};
export const MELODY_RHYTHMS = [
  [4, 4, 4, 4, 8, -8], [2, 2, 4, 2, 2, 4, 8, -8], [3, 3, 2, 3, 3, 2, 12, -4], [6, 2, 4, 4, 12, -4],
  [2, 2, 2, 2, 4, 4, 12, -4], [4, 2, 2, 4, 4, 12, -4], [-2, 2, 4, 4, 2, 2, 12, -4], [4, 4, 2, 2, 4, 8, -8],
  [2, 2, 2, 2, 2, 2, 4, 6, -10], [3, 3, 2, 8, 3, 3, 2, 8], [4, 2, 2, 2, 2, 4, 12, -4], [-4, 2, 2, 4, 4, 4, 8, -4],
  [2, 4, 2, 4, 4, 12, -4], [4, 4, 8, 4, 4, 8], [6, 6, 4, 6, 6, 4], [-2, 2, 2, 2, 4, 2, 2, 4, 8, -4],
];
export const WALTZ_RHYTHMS = [
  [4, 4, 4, 12], [8, 4, 12], [4, 4, 4, 4, 4, 4], [2, 2, 4, 4, 12], [6, 6, 12], [4, 8, 4, 8], [2, 2, 2, 2, 4, 12], [8, 4, 4, 8], [4, 4, 4, 8, -4], [12, 4, 4, 4], [4, 2, 2, 4, 12], [-4, 4, 4, 4, 8],
];
// leads that sit low get nudged up; big sections play softer than the whistle would
export const LIFT = { bassoon: 5, french_horn: 3 };
export const SOFT = { string_ensemble_1: 0.8, french_horn: 0.8, orchestral_harp: 0.9, rock_organ: 0.85 };
export const RANGE = {
  whistle: [67, 84], clarinet: [60, 84], glockenspiel: [84, 103], muted_trumpet: [60, 79], electric_piano_1: [67, 88],
  french_horn: [48, 72], string_ensemble_1: [48, 84], choir_aahs: [55, 79], orchestral_harp: [43, 96], bassoon: [36, 60],
  tuba: [29, 50], pizzicato_strings: [43, 79], rock_organ: [48, 84], electric_guitar_muted: [52, 76], electric_bass_finger: [31, 50],
};

// A groove is the rhythmic character of a station: tempo, meter, feel, kit, bass, comping, and who carries the tune.
const GROOVES = {
  funk: { tempo: [100, 118], beats: 4, swing: [[0, 3], [0.35, 1]], kit: 'full', shaker: 1, guitar: 0.85, bass: ['funk', 'sync', 'pop', 'oct', 'ref2'], comp: [['electric_piano_1', 4], ['rock_organ', 2]], compPat: 'funk', leads: [['whistle', 4], ['clarinet', 2], ['muted_trumpet', 2], ['electric_piano_1', 1], ['rock_organ', 1], ['glockenspiel', 1]], flavors: { funk: 5, caper: 2, goofy: 1, sweet: 1 }, plan: 'score' },
  lounge: { tempo: [64, 78], beats: 4, swing: [[0.5, 2], [0, 1]], kit: 'brush', shaker: 0, guitar: 0, bass: ['long', 'ref', 'walk'], comp: [['electric_piano_1', 3], ['rock_organ', 2]], compPat: 'pad', leads: [['electric_piano_1', 3], ['clarinet', 3], ['muted_trumpet', 2], ['string_ensemble_1', 2], ['orchestral_harp', 1], ['whistle', 1]], flavors: { sweet: 5, funk: 1 }, plan: 'mellow' },
  lazy: { tempo: [74, 88], beats: 4, swing: [[0, 2], [0.3, 1]], kit: 'half', shaker: 1, guitar: 0.3, bass: ['long', 'ref', 'ref2'], comp: [['electric_piano_1', 5], ['rock_organ', 1]], compPat: 'lazy', leads: [['whistle', 3], ['glockenspiel', 2], ['electric_piano_1', 2], ['orchestral_harp', 1.5], ['clarinet', 1]], flavors: { sweet: 4, goofy: 2, funk: 1 }, plan: 'score' },
  bossa: { tempo: [96, 112], beats: 4, swing: 0, kit: 'bossa', shaker: 1, guitar: 0.4, bass: ['bossa'], comp: [['electric_piano_1', 5], ['rock_organ', 1]], compPat: 'bossa', leads: [['whistle', 3], ['clarinet', 2], ['muted_trumpet', 2], ['electric_piano_1', 2], ['glockenspiel', 1]], flavors: { sweet: 4, caper: 2, funk: 1 }, plan: 'score' },
  shuffle: { tempo: [104, 124], beats: 4, swing: 1, kit: 'shuffle', shaker: 0, guitar: 0.5, bass: ['walk', 'boogie', 'ref2'], comp: [['rock_organ', 4], ['electric_piano_1', 2]], compPat: 'shuffle', leads: [['rock_organ', 3], ['clarinet', 3], ['muted_trumpet', 2], ['whistle', 1.5], ['bassoon', 1]], flavors: { goofy: 4, caper: 3, funk: 2 }, plan: 'score' },
  disco: { tempo: [122, 138], beats: 4, swing: 0, kit: 'four', shaker: 2, guitar: 0.9, bass: ['disco', 'oct'], comp: [['electric_piano_1', 3], ['rock_organ', 3]], compPat: 'stab', leads: [['whistle', 3], ['muted_trumpet', 2], ['string_ensemble_1', 2], ['french_horn', 1.5], ['glockenspiel', 1], ['rock_organ', 1]], flavors: { caper: 4, funk: 3, goofy: 1 }, plan: 'big' },
  march: { tempo: [108, 124], beats: 4, swing: 0, kit: 'march', shaker: 0, guitar: 0, bass: ['tuba'], comp: [['electric_piano_1', 2], ['none', 1]], compPat: 'offbeat', leads: [['bassoon', 3], ['clarinet', 3], ['glockenspiel', 2], ['muted_trumpet', 1.5], ['whistle', 1]], flavors: { goofy: 5, caper: 2 }, plan: 'big' },
  waltz: { tempo: [100, 138], beats: 3, swing: 0, kit: 'waltz', shaker: 0, guitar: 0, bass: ['waltz', 'waltz2'], comp: [['electric_piano_1', 3], ['rock_organ', 1], ['none', 1]], compPat: 'waltz', leads: [['string_ensemble_1', 3], ['clarinet', 3], ['glockenspiel', 2], ['whistle', 1.5], ['french_horn', 1], ['orchestral_harp', 1]], flavors: { sweet: 4, goofy: 2, caper: 1 }, plan: 'mellow' },
};
export const INTROS = {
  funk: [['vamp', 4], ['slide', 2], ['solo', 2], ['harp', 1]], lounge: [['solo', 3], ['harp', 2], ['vamp', 2]], lazy: [['vamp', 3], ['solo', 2], ['harp', 2], ['slide', 1]],
  bossa: [['vamp', 4], ['solo', 2], ['harp', 1]], shuffle: [['vamp', 3], ['slide', 3], ['solo', 1]], disco: [['vamp', 4], ['slide', 2]], march: [['oompah', 5], ['solo', 1]], waltz: [['harp', 3], ['solo', 2], ['vamp', 2]],
};

// A station's personality: fixed for the frequency, shapes every cue it plays.
export function stationProfile(id) {
  const r = new Rng(hash32(id, 0x5eed));
  const groove = r.weighted([['funk', 3], ['lazy', 2], ['bossa', 2], ['lounge', 1.5], ['shuffle', 1.5], ['disco', 1.5], ['waltz', 1.5], ['march', 1]]);
  const G = GROOVES[groove];
  const lead = r.weighted(G.leads), second = r.weighted(G.leads.filter(([x]) => x !== lead));
  return {
    groove, beats: G.beats, tempo: G.tempo, swing: typeof G.swing === 'number' ? G.swing : r.weighted(G.swing),
    melody: [[lead, 6], [second, 2]], comp: r.weighted(G.comp), compPat: G.compPat, plan: G.plan,
    kit: G.kit === 'full' ? r.weighted([['full', 4], ['light', 1], ['perc', 1]]) : G.kit, shaker: G.shaker, guitar: r.chance(G.guitar), bass: G.bass,
    orchestra: r.weighted([['full', 3], ['chamber', 2], ['none', 1]]),
    mode: r.weighted([['major', 5], ['mixo', 2], ['minor', 2]]),
    flavors: Object.entries(G.flavors),
    space: r.range(0.6, 1.4),
  };
}
export const DEFAULT_PROFILE = stationProfile(1013);
