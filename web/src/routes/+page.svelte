<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { loadSamples } from '$lib/samples';
	import { Engine, Player } from '$lib/engine.js';
	import { createStation, stationName, EPOCH } from '$lib/composer.js';
	import Dial from '$lib/ui/Dial.svelte';
	import Knob from '$lib/ui/Knob.svelte';
	import VuMeter from '$lib/ui/VuMeter.svelte';
	import Mixer from '$lib/ui/Mixer.svelte';
	import Scope from '$lib/ui/Scope.svelte';
	import { attach, useStation, param } from '$lib/mix.svelte';
	import Stations from '$lib/ui/Stations.svelte';
	import People from '$lib/ui/People.svelte';

	type Person = { name: string; emoji: string };
	type Station = { id: number; listeners: number; lastHeard: number; people: Person[] };
	const LO = 875, HI = 1080;
	const SHORT: Record<string, string> = { electric_piano_1: 'wurly', string_ensemble_1: 'strings', rock_organ: 'organ', french_horn: 'horn', orchestral_harp: 'harp', glockenspiel: 'glock', muted_trumpet: 'muted trumpet' };

	let freq = $state(1013);
	let power = $state(true);
	let playing = $state(false);
	let loading = $state('');
	let engine = $state<Engine | null>(null);
	let stations = $state<Station[]>([]);
	let totalListeners = $state(0);
	let me = $state<Person | null>(null);
	let now = $state<{ cue: string; section: string; chord: string } | null>(null);
	let level = $state(0);
	let mixerOpen = $state(false);
	let silent = $state(false);
	let clockOffset = 0, player: Player | null = null, retune = 0, starting = false, ready: Promise<void>;
	// a listener is this tab; a person is this browser, and their name follows them back tomorrow
	const keep = (store: Storage, k: string) => { try { let v = store.getItem(k); if (!v) { v = crypto.randomUUID(); store.setItem(k, v); } return v; } catch { return crypto.randomUUID(); } };
	const listenerId = keep(sessionStorage, 'ngr.listener'), personId = keep(localStorage, 'ngr.person');

	const name = $derived(stationName(freq));
	const onair = $derived(new Map(stations.filter((s) => s.listeners > 0).map((s) => [s.id, s.listeners])));
	const recent = $derived(new Set(stations.filter((s) => s.listeners === 0).map((s) => s.id)));
	const mine = $derived(stations.find((s) => s.id === freq));
	const without = (s: Station) => (me && s.people.some((p) => p.name === me!.name) ? { ...s, listeners: Math.max(0, s.listeners - 1), people: s.people.filter((p) => p.name !== me!.name) } : s);
	const withMe = (s: Station) => (me && !s.people.some((p) => p.name === me!.name) ? { ...s, listeners: s.listeners + 1, people: [...s.people, me] } : s);
	const stationTime = () => (Date.now() + clockOffset) / 1000 - EPOCH;
	const url = () => `?fm=${(freq / 10).toFixed(1)}` + (param() ? `&mix=${param()}` : '');

	async function syncClock() {
		const t0 = Date.now();
		const { data } = await api.GET('/now');
		if (data) clockOffset = data.now - (t0 + Date.now()) / 2;
	}
	async function refresh() {
		const { data } = await api.GET('/stations');
		if (data) { stations = data.stations; totalListeners = data.listeners; }
	}
	async function beat(station = freq) {
		if (!power) return;
		const { data } = await api.POST('/listen', { body: { station, listener: listenerId, person: personId } });
		if (!data) return;
		me = data.you;
		stations = stations.some((s) => s.id === station) ? stations.map((s) => (s.id === station ? data.station : s)) : [data.station, ...stations];
		refresh();
	}
	function leave() {
		try { navigator.sendBeacon('/api/leave', new Blob([JSON.stringify({ listener: listenerId })], { type: 'application/json' })); } catch { /* page is going away anyway */ }
		stations = stations.map((s) => (s.id === freq ? without(s) : s));
	}
	function prepare() {
		if (ready) return ready;
		loading = 'warming up';
		ready = (async () => {
			// localhost never reaches the speakers unless asked with ?sound=1, so working on this page can't make noise; ?mute=1 silences anywhere
			const q = new URLSearchParams(location.search);
			silent = q.has('mute') || (['localhost', '127.0.0.1'].includes(location.hostname) && !q.has('sound'));
			const opts = { latencyHint: 'playback' } as AudioContextOptions;
			let ctx: AudioContext;
			try { ctx = new AudioContext(silent ? { ...opts, sinkId: { type: 'none' } } as AudioContextOptions : opts); } catch { ctx = new AudioContext(opts); }
			const e = new Engine(ctx, { silent });
			(window as unknown as { __ngr: unknown }).__ngr = { engine: e, get player() { return player; } };
			const samples = await loadSamples((d, t) => (loading = `loading instruments ${d}/${t}`));
			await e.load(samples, (p, inst) => (loading = `tuning ${inst.replace(/_/g, ' ')} ${Math.round(p * 100)}%`));
			engine = e; attach(e); loading = '';
		})();
		return ready;
	}
	// browsers only let audio start after the person has touched the page; until then we sit armed
	async function tuneIn() {
		if (starting) return;
		starting = true;
		try {
			await prepare();
			if (!engine || !power) return;
			if (engine.ctx.state !== 'running') await Promise.race([engine.ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
			if (engine.ctx.state !== 'running') return;
			player?.stop();
			player = new Player(engine, (bar) => { now = bar.silent ? null : { cue: `${bar.cue.keyName} · ${bar.cue.prog} · ${bar.tempo} bpm ${bar.beats}/4 · ${bar.cue.groove} · ${bar.cue.flavor}`, section: `${bar.section.name} ${bar.section.index + 1}/${bar.section.bars} · ${SHORT[bar.cue.melodyInst] ?? bar.cue.melodyInst}`, chord: bar.chord }; });
			const station = createStation(freq);
			engine.setSpace(station.profile.space);
			player.start(station, stationTime);
			playing = true;
			beat();
		} finally { starting = false; }
	}
	function stop() { player?.stop(); player = null; playing = false; now = null; }
	function tune(id: number) {
		id = Math.min(HI, Math.max(LO, id));
		if (id === freq) return;
		const from = freq;
		freq = id; now = null;
		useStation(id);
		history.replaceState(null, '', url());
		if (power) {
			stations = stations.map((s) => (s.id === from ? without(s) : s.id === id ? withMe(s) : s));
			if (me && !stations.some((s) => s.id === id)) stations = [...stations, { id, listeners: 1, lastHeard: Math.floor(Date.now() / 1000), people: [me] }];
			beat(id);
		}
		if (!playing || !engine) return;
		stop();
		engine.static_(engine.ctx.currentTime + 0.02, 0.35, 0.18);
		clearTimeout(retune); retune = setTimeout(tuneIn, 380);
	}
	function toggle() {
		power = !power;
		if (power) tuneIn();
		else { clearTimeout(retune); stop(); leave(); }
	}
	function kick(e: Event) {
		if ((e.target as HTMLElement).closest?.('.power')) return;
		if (power && !playing) tuneIn();
	}

	onMount(() => {
		const params = new URLSearchParams(location.search), fm = parseFloat(params.get('fm') || '');
		if (fm) freq = Math.min(HI, Math.max(LO, Math.round(fm * 10)));
		useStation(freq, params.get('mix'));
		$effect.root(() => { $effect(() => { const u = url(); if (location.search !== u) history.replaceState(null, '', u); }); });
		syncClock(); refresh(); tuneIn();
		const timers = [setInterval(refresh, 5000), setInterval(syncClock, 300000), setInterval(beat, 10000)];
		window.addEventListener('click', kick); window.addEventListener('keydown', kick);
		const bye = () => { if (power) leave(); };
		window.addEventListener('pagehide', bye);
		const buf = new Uint8Array(512);
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			if (!engine || !playing) { level *= 0.9; return; }
			engine.analyser.getByteTimeDomainData(buf);
			let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; }
			level = level * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 4) * 0.3;
		};
		draw();
		const keys = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).tagName === 'INPUT') return;
			if (e.code === 'Space') { e.preventDefault(); toggle(); }
			if (e.key === 'ArrowLeft') tune(freq - 1);
			if (e.key === 'ArrowRight') tune(freq + 1);
		};
		window.addEventListener('keydown', keys);
		return () => { timers.forEach(clearInterval); cancelAnimationFrame(raf); window.removeEventListener('keydown', keys); window.removeEventListener('click', kick); window.removeEventListener('keydown', kick); window.removeEventListener('pagehide', bye); };
	});
</script>

<svelte:head><title>{name.freq} {name.call} · Normal Radio</title></svelte:head>

<main>
	<div class="cabinet">
	<div class="radio">
		<div class="top">
			<div class="grille"></div>
			<div class="display">
				<div class="row1"><span class="big">{name.freq}</span><span class="unit">FM</span><span class="call">{name.call}</span>{#if silent}<span class="hush">silent</span>{/if}<span class="fill"></span>{#if me}<span class="me">{me.emoji} {me.name}</span>{/if}<span class="who" class:lit={(mine?.listeners ?? 0) > 1}><People people={mine?.people ?? []} {me} /></span></div>
				<div class="row2">{name.slogan}</div>
				<div class="row3">
					{#if loading}{loading}
					{:else if now}{now.cue} · {now.section} · <b>{now.chord}</b>
					{:else if power && engine && !playing}tap anywhere to start
					{:else if power}tuning…
					{:else}{totalListeners} {totalListeners === 1 ? 'person' : 'people'} listening across the band{/if}
				</div>
			</div>
			<div class="grille"></div>
		</div>

		<Dial {freq} {onair} {recent} onTune={tune} />
		<Scope {engine} {playing} />

		<div class="controls">
			<div class="vu"><VuMeter {level} /></div>
			<div class="buttons">
				<button class="btn power" class:on={power} class:live={playing} onclick={toggle} aria-pressed={power}><i class="led"></i>Power</button>
				<button class="btn" class:on={mixerOpen} onclick={() => (mixerOpen = !mixerOpen)} aria-pressed={mixerOpen}>Mixer</button>
			</div>
			<div class="tuner"><Knob value={freq} onStep={(d) => tune(freq + d)} /><span class="plate">TUNE</span></div>
		</div>

		{#if mixerOpen}<div class="drawer"><Mixer /></div>{/if}
	</div>

	<Stations {stations} {me} current={freq} onTune={tune} />
	</div>
</main>

<style>
	main { max-width: 1400px; margin: 0 auto; padding: 28px 16px 60px; }
	@media (max-width: 1040px) { main { max-width: 780px; } }

	/* one cabinet: the control face on the left, the station selector on the right, both the same height */
	.cabinet {
		display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr); gap: 18px; padding: 22px; border-radius: 36px;
		background-color: #1c1714;
		background-image: repeating-radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.03) 0 1.5px, transparent 1.5px 4px), linear-gradient(180deg, #2c2520, #16120f);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 0 0 5px #0b0907, inset 0 0 0 6px rgba(255, 255, 255, 0.22), inset 0 0 0 8px #0b0907, 0 40px 80px rgba(0, 0, 0, 0.7), 0 4px 10px rgba(0, 0, 0, 0.6);
	}
	@media (max-width: 1040px) { .cabinet { grid-template-columns: 1fr; } }

	.radio {
		border-radius: 22px; padding: 22px;
		background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 1px, rgba(0, 0, 0, 0.06) 1px 2px), linear-gradient(180deg, #dedede 0%, #bdbdbd 28%, #9d9d9d 62%, #c7c7c7 100%);
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.85), inset 0 -3px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.6);
	}
	.top { display: grid; grid-template-columns: 70px 1fr 70px; gap: 16px; margin-bottom: 18px; }
	.grille { border-radius: 12px; background-color: #6f6f6f; background-image: radial-gradient(circle at center, #171717 0 1.7px, transparent 2.1px); background-size: 7px 7px; box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 0 0 1px #333, 0 1px 0 rgba(255, 255, 255, 0.6); }
	.display {
		border-radius: 10px; padding: 12px 16px; min-height: 96px; color: #7bffb0;
		background: radial-gradient(ellipse at 50% 0%, #1a2b22, #0b1410 70%);
		box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.8), inset 0 0 0 2px #2c2a27, 0 1px 0 rgba(255, 255, 255, 0.6);
		font-family: "SF Mono", Menlo, Consolas, monospace; text-shadow: 0 0 6px rgba(120, 255, 170, 0.6);
	}
	.row1 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 10px; }
	.big { font-size: 40px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; }
	.unit { font-size: 14px; letter-spacing: 0.2em; }
	.call { font-size: 14px; letter-spacing: 0.25em; color: #a9ffcc; }
	.hush { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #ff6b6b; text-shadow: 0 0 8px rgba(255, 80, 80, 0.7); }
	.fill { flex: 1; }
	.me { font-size: 12px; letter-spacing: 0.06em; color: #ffb347; text-shadow: 0 0 8px rgba(255, 150, 40, 0.5); white-space: nowrap; }
	.who { font-size: 12px; letter-spacing: 0.1em; color: #4c7a5e; text-shadow: none; }
	.who.lit { color: #ffb347; text-shadow: 0 0 8px rgba(255, 150, 40, 0.7); }
	.row2 { margin-top: 6px; font-size: 13px; letter-spacing: 0.08em; color: #a9ffcc; text-transform: uppercase; }
	.row3 { margin-top: 8px; font-size: 12px; color: #5fd88e; min-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.row3 b { color: #c7ffdc; }

	.controls { display: grid; grid-template-columns: 1fr auto auto; gap: 22px; align-items: center; margin-top: 20px; }
	.vu { max-width: 220px; }
	.buttons { display: grid; gap: 10px; justify-items: stretch; }
	.btn {
		display: flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 9px; border: 1px solid #3a3a3a;
		background: linear-gradient(180deg, #fdfdfd 0%, #e2e2e2 48%, #c9c9c9 52%, #e9e9e9 100%);
		color: #2b2b2b; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
		box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 rgba(0, 0, 0, 0.25), 0 2px 3px rgba(0, 0, 0, 0.45);
	}
	.btn:active, .btn.on { background: linear-gradient(180deg, #c8c8c8, #e6e6e6); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.6); }
	.led { width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #7a7a7a, #303030); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4); }
	.power.on .led { background: radial-gradient(circle at 40% 35%, #ffe2a8, #d98a00); box-shadow: 0 0 8px rgba(255, 170, 40, 0.8); }
	.power.live .led { background: radial-gradient(circle at 40% 35%, #b9ffcf, #12b04c); box-shadow: 0 0 10px rgba(40, 220, 100, 0.9); }
	.tuner { display: grid; justify-items: center; gap: 8px; }
	.plate { font-size: 10px; letter-spacing: 0.3em; color: #4a4a4a; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7); }
	.drawer { margin-top: 18px; }

	@media (max-width: 640px) {
		main { padding: 10px 8px 40px; }
		.cabinet { gap: 10px; padding: 12px; border-radius: 24px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 0 0 3px #0b0907, inset 0 0 0 4px rgba(255, 255, 255, 0.22), inset 0 0 0 5px #0b0907, 0 20px 40px rgba(0, 0, 0, 0.7); }
		.top { grid-template-columns: 1fr; margin-bottom: 12px; }
		.grille { display: none; }
		.display { padding: 10px 12px; min-height: 0; }
		.controls { grid-template-columns: 1fr auto; gap: 12px 16px; margin-top: 14px; }
		.vu { max-width: 170px; }
		.buttons { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; }
		.radio { padding: 12px; border-radius: 16px; }
		.big { font-size: 30px; }
		.row3 { white-space: normal; }
	}
</style>
