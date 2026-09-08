import { Engine } from './audio/engine.js';
import { Player } from './audio/player.js';
import { createStation, EPOCH } from './music/station.js';
import { loadSamples } from './samples';
import { attach } from './mix.svelte';
import { api } from './api';

type Now = { cue: string; section: string; chord: string };
export const radio = $state({ engine: null as Engine | null, playing: false, loading: '', silent: false, now: null as Now | null });

const SHORT: Record<string, string> = { electric_piano_1: 'wurly', string_ensemble_1: 'strings', rock_organ: 'organ', french_horn: 'horn', orchestral_harp: 'harp', glockenspiel: 'glock', muted_trumpet: 'muted trumpet' };
let player: Player | null = null, clockOffset = 0, ready: Promise<void> | undefined, starting = false, retimer = 0;

export async function syncClock() {
	const t0 = Date.now();
	const { data } = await api.GET('/now');
	if (data) clockOffset = data.now - (t0 + Date.now()) / 2;
}
export const stationTime = () => (Date.now() + clockOffset) / 1000 - EPOCH;

function prepare() {
	if (ready) return ready;
	radio.loading = 'warming up';
	ready = (async () => {
		// localhost never reaches the speakers unless asked with ?sound=1, so working on this page can't make noise; ?mute=1 silences anywhere
		const q = new URLSearchParams(location.search);
		radio.silent = q.has('mute') || (['localhost', '127.0.0.1'].includes(location.hostname) && !q.has('sound'));
		const opts = { latencyHint: 'playback' } as AudioContextOptions;
		let ctx: AudioContext;
		try { ctx = new AudioContext(radio.silent ? ({ ...opts, sinkId: { type: 'none' } } as AudioContextOptions) : opts); } catch { ctx = new AudioContext(opts); }
		const e = new Engine(ctx, { silent: radio.silent });
		(window as unknown as { __ngr: unknown }).__ngr = { engine: e, get player() { return player; } };
		const samples = await loadSamples((d, t) => (radio.loading = `loading instruments ${d}/${t}`));
		await e.load(samples, (p, inst) => (radio.loading = `tuning ${inst.replace(/_/g, ' ')} ${Math.round(p * 100)}%`));
		radio.engine = e; attach(e); radio.loading = '';
	})();
	return ready;
}

// browsers only let audio start after the person has touched the page; until then we sit armed.
// `want` is read after the instruments are in, so a station chosen while they loaded is the one that plays.
export async function tuneIn(want: () => number): Promise<boolean> {
	if (starting) return false;
	starting = true;
	try {
		await prepare();
		const e = radio.engine;
		if (!e) return false;
		if (e.ctx.state !== 'running') await Promise.race([e.ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
		if (e.ctx.state !== 'running') return false;
		player?.stop();
		player = new Player(e, (bar) => {
			radio.now = bar.silent ? null : { cue: `${bar.cue.keyName} · ${bar.cue.prog} · ${bar.tempo} bpm ${bar.beats}/4 · ${bar.cue.groove} · ${bar.cue.flavor}`, section: `${bar.section.name} ${bar.section.index + 1}/${bar.section.bars} · ${SHORT[bar.cue.melodyInst] ?? bar.cue.melodyInst}`, chord: bar.chord };
		});
		const station = createStation(want());
		e.setSpace(station.profile.space);
		player.start(station, stationTime);
		radio.playing = true;
		return true;
	} finally { starting = false; }
}
export function stop() { clearTimeout(retimer); player?.stop(); player = null; radio.playing = false; radio.now = null; }
// a burst of static, then whatever station is wanted by the time it clears
export function retune(want: () => number) {
	if (!radio.engine) return;
	stop();
	radio.engine.static_(radio.engine.ctx.currentTime + 0.02, 0.35, 0.18);
	retimer = setTimeout(() => tuneIn(want), 380);
}
