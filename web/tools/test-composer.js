// node tools/test-composer.js [stationId] — structural checks on the composer, no audio.
import { createStation, createRadio, chordTones, RANGE, SEGMENT, stationName } from '../src/lib/composer.js';

const id = parseInt(process.argv[2] || '1013', 10);
let problems = 0;
const bad = (...m) => { problems++; console.log('PROBLEM', ...m); };

// a radio with a deadline ends exactly on it, with an outro before the silence
const radio = createRadio(42, SEGMENT);
let elapsed = 0, bars = 0, names = [], last;
for (let b; (b = radio.nextBar()); ) { elapsed += b.dur; bars++; names.push(b.section.name); last = b; }
if (Math.abs(elapsed - SEGMENT) > 1e-6) bad('segment length', elapsed);
if (!last.silent || names[names.length - 2] !== 'outro') bad('segment ending', names.slice(-4));

// every listener computes the same bar for the same station time
const s1 = createStation(id), s2 = createStation(id);
const t = 86400 * 3 + 777.7;
const a = s1.tune(t), b = s2.tune(t);
if (a.start !== b.start || JSON.stringify(a.bar.events) !== JSON.stringify(b.bar.events)) bad('tune is not deterministic');
if (!(a.start <= t && t < a.start + a.bar.dur)) bad('tune landed outside the bar', a.start, t, a.bar.dur);
const c = s1.next();
if (Math.abs(c.start - (a.start + a.bar.dur)) > 1e-6) bad('next bar not contiguous');

// events stay in range and in time across a few segments
let ev = 0, strong = 0, strongChord = 0;
for (let i = 0; i < 1500; i++) {
	const { bar } = s1.next();
	for (const e of bar.events) {
		ev++;
		if (isNaN(e.t) || isNaN(e.dur) || e.dur <= 0 || e.t < -0.6 || e.t >= 4) bad('time', e);
		const r = RANGE[e.inst];
		if (e.note != null && r && (e.note < r[0] - 12 || e.note > r[1] + 12)) bad('range', e.inst, e.note);
		if (e.inst === bar.cue.melodyInst && ['A', 'B', 'climax'].includes(bar.section.name) && e.dur > 0.2 && Math.abs(e.t - Math.round(e.t)) < 0.01 && Math.round(e.t) % 2 === 0) {
			strong++;
			const root = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].indexOf(bar.chord.replace(/m|7/g, ''));
			const q = bar.chord.endsWith('m') ? 'min' : bar.chord.endsWith('7') ? 'dom' : 'maj';
			if (chordTones({ root, q }).includes(((e.note % 12) + 12) % 12)) strongChord++;
		}
	}
}
console.log(`station ${id} ${stationName(id).call} ${stationName(id).freq}: ${bars} bars/segment, ${ev} events/1500 bars, melody on chord tones at strong beats ${Math.round(100 * strongChord / strong)}%, problems ${problems}`);
process.exit(problems ? 1 : 0);
