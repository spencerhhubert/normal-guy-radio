// node tools/test-composer.js — structural checks on the composer, no audio.
import { createStation, createRadio, chordTones, RANGE, SEGMENT, stationName, stationProfile } from '../src/lib/composer.js';

let problems = 0;
const bad = (...m) => { problems++; console.log('PROBLEM', ...m); };
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// a radio with a deadline ends exactly on it, with an outro before the silence
const radio = createRadio(42, SEGMENT);
let elapsed = 0, names = [], last;
for (let b; (b = radio.nextBar()); ) { elapsed += b.dur; names.push(b.section.name); last = b; }
if (Math.abs(elapsed - SEGMENT) > 1e-6) bad('segment length', elapsed);
if (!last.silent || names[names.length - 2] !== 'outro') bad('segment ending', names.slice(-4));

// every listener computes the same bar for the same station time
const s1 = createStation(1013), s2 = createStation(1013);
const t = 86400 * 3 + 777.7;
const a = s1.tune(t), b = s2.tune(t);
if (a.start !== b.start || JSON.stringify(a.bar.events) !== JSON.stringify(b.bar.events)) bad('tune is not deterministic');
if (!(a.start <= t && t < a.start + a.bar.dur)) bad('tune landed outside the bar', a.start, t, a.bar.dur);
const c = s1.next();
if (Math.abs(c.start - (a.start + a.bar.dur)) > 1e-6) bad('next bar not contiguous');

// one station per groove: events stay in range and in time, melodies land on chord tones
const first = new Map(), count = {};
for (let id = 875; id <= 1080; id++) { const g = stationProfile(id).groove; count[g] = (count[g] || 0) + 1; if (!first.has(g)) first.set(g, id); }
for (const [groove, id] of first) {
	const s = createStation(id); s.tune(1000);
	let ev = 0, strong = 0, strongChord = 0, tempo = 0, beats = 0, bars = 800;
	for (let i = 0; i < bars; i++) {
		const { bar } = s.next();
		tempo += bar.tempo; beats = bar.beats;
		for (const e of bar.events) {
			ev++;
			if (isNaN(e.t) || isNaN(e.dur) || e.dur <= 0 || e.t < -0.6 || e.t >= bar.beats + 0.2) bad(groove, 'time', e);
			const r = RANGE[e.inst];
			if (e.note != null && r && (e.note < r[0] - 12 || e.note > r[1] + 12)) bad(groove, 'range', e.inst, e.note);
			const onBeat = Math.abs(e.t - Math.round(e.t)) < 0.01, strongBeat = bar.beats === 3 ? Math.round(e.t) === 0 : Math.round(e.t) % 2 === 0;
			if (e.inst === bar.cue.melodyInst && ['A', 'B', 'climax'].includes(bar.section.name) && e.dur > 0.2 && onBeat && strongBeat) {
				strong++;
				const root = NAMES.indexOf(bar.chord.replace(/m|7/g, '')), q = bar.chord.endsWith('m') ? 'min' : bar.chord.endsWith('7') ? 'dom' : 'maj';
				if (chordTones({ root, q }).includes(((e.note % 12) + 12) % 12)) strongChord++;
			}
		}
	}
	const n = stationName(id);
	console.log(`${groove.padEnd(8)} ${count[groove].toString().padStart(3)} stations  e.g. ${n.freq} ${n.call}: ${Math.round(tempo / bars)} bpm ${beats}/4, ${ev} events/${bars} bars, chord tones on strong beats ${Math.round((100 * strongChord) / strong)}%`);
}
console.log(`problems ${problems}`);
process.exit(problems ? 1 : 0);
