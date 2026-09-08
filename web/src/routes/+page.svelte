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
	import Stations from '$lib/ui/Stations.svelte';

	type Station = { id: number; listeners: number; lastHeard: number };
	const LO = 875, HI = 1080;

	let freq = $state(1013);
	let power = $state(false);
	let loading = $state('');
	let engine = $state<Engine | null>(null);
	let stations = $state<Station[]>([]);
	let totalListeners = $state(0);
	let here = $state(0);
	let now = $state<{ cue: string; section: string; chord: string } | null>(null);
	let level = $state(0);
	let mixerOpen = $state(false);
	let clockOffset = 0, player: Player | null = null, retune = 0, heartbeat = 0, ready: Promise<void>;
	const listenerId = (() => { try { const k = 'ngr.listener'; let v = localStorage.getItem(k); if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); } return v; } catch { return crypto.randomUUID(); } })();

	const name = $derived(stationName(freq));
	const onair = $derived(new Map(stations.filter((s) => s.listeners > 0).map((s) => [s.id, s.listeners])));
	const recent = $derived(new Set(stations.filter((s) => s.listeners === 0).map((s) => s.id)));
	const stationTime = () => (Date.now() + clockOffset) / 1000 - EPOCH;

	async function syncClock() {
		const t0 = Date.now();
		const { data } = await api.GET('/now');
		if (data) clockOffset = data.now - (t0 + Date.now()) / 2;
	}
	async function refresh() {
		const { data } = await api.GET('/stations');
		if (data) { stations = data.stations; totalListeners = data.listeners; here = data.stations.find((s) => s.id === freq)?.listeners ?? (power ? 1 : 0); }
	}
	async function beat() {
		if (!power) return;
		const { data } = await api.POST('/listen', { body: { station: freq, listener: listenerId } });
		if (data) here = data.listeners;
	}
	function prepare() {
		if (ready) return ready;
		loading = 'warming up';
		ready = (async () => {
			const ctx = new AudioContext({ latencyHint: 'playback' });
			const e = new Engine(ctx);
			if (new URLSearchParams(location.search).has('mute')) e.master.disconnect();
			(window as unknown as { __ngr: unknown }).__ngr = { engine: e, get player() { return player; } };
			const samples = await loadSamples((d, t) => (loading = `loading instruments ${d}/${t}`));
			await e.load(samples, (p, inst) => (loading = `tuning ${inst.replace(/_/g, ' ')} ${Math.round(p * 100)}%`));
			engine = e; loading = '';
		})();
		return ready;
	}
	async function tuneIn() {
		await prepare();
		if (!engine || !power) return;
		await engine.ctx.resume();
		player?.stop();
		player = new Player(engine, (bar) => { now = bar.silent ? null : { cue: `${bar.cue.keyName} · ${bar.cue.prog} · ${bar.tempo} bpm · ${bar.cue.flavor}`, section: `${bar.section.name} ${bar.section.index + 1}/${bar.section.bars} · ${bar.cue.melodyInst.replace(/_/g, ' ')}`, chord: bar.chord }; });
		player.start(createStation(freq), stationTime);
		beat();
	}
	function tune(id: number) {
		id = Math.min(HI, Math.max(LO, id));
		if (id === freq) return;
		freq = id; now = null; here = onair.get(id) ?? 0;
		history.replaceState(null, '', `?fm=${(id / 10).toFixed(1)}`);
		if (!power || !engine) return;
		player?.stop(); player = null;
		engine.static_(engine.ctx.currentTime + 0.02, 0.35, 0.18);
		clearTimeout(retune); retune = setTimeout(tuneIn, 380);
	}
	async function toggle() {
		power = !power;
		if (power) { await tuneIn(); heartbeat = setInterval(beat, 20000); }
		else { clearInterval(heartbeat); player?.stop(); player = null; now = null; here = Math.max(0, here - 1); }
	}

	onMount(() => {
		const fm = parseFloat(new URLSearchParams(location.search).get('fm') || '');
		if (fm) freq = Math.min(HI, Math.max(LO, Math.round(fm * 10)));
		syncClock(); refresh();
		const timers = [setInterval(refresh, 10000), setInterval(syncClock, 300000)];
		const buf = new Uint8Array(512);
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			if (!engine || !power) { level *= 0.9; return; }
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
		return () => { timers.forEach(clearInterval); cancelAnimationFrame(raf); window.removeEventListener('keydown', keys); };
	});
</script>

<svelte:head><title>{name.freq} {name.call} · Normal Guy Radio</title></svelte:head>

<main>
	<header>
		<h1>Normal Guy Radio</h1>
		<p>a completely normal guy's life is about to get way more complicated. on every station. forever.</p>
	</header>

	<div class="radio">
		<div class="top">
			<div class="grille"></div>
			<div class="display">
				<div class="row1"><span class="big">{name.freq}</span><span class="unit">FM</span><span class="call">{name.call}</span><span class="fill"></span><span class="who" class:lit={here > 0}>{here} listening</span></div>
				<div class="row2">{name.slogan}</div>
				<div class="row3">
					{#if loading}{loading}
					{:else if now}{now.cue} · {now.section} · <b>{now.chord}</b>
					{:else if power}tuning…
					{:else}{totalListeners} {totalListeners === 1 ? 'person' : 'people'} listening across the band{/if}
				</div>
			</div>
			<div class="grille"></div>
		</div>

		<Dial {freq} {onair} {recent} onTune={tune} />

		<div class="controls">
			<div class="vu"><VuMeter {level} /></div>
			<div class="buttons">
				<button class="btn power" class:on={power} onclick={toggle} aria-pressed={power}><i class="led"></i>Power</button>
				<button class="btn" class:on={mixerOpen} onclick={() => (mixerOpen = !mixerOpen)} aria-pressed={mixerOpen}>Mixer</button>
			</div>
			<div class="tuner"><Knob value={freq} onStep={(d) => tune(freq + d)} /><span class="plate">TUNE</span></div>
		</div>

		{#if mixerOpen}<div class="drawer"><Mixer {engine} /></div>{/if}
	</div>

	<Stations {stations} current={freq} onTune={tune} />

	<footer>Every station is composed live in your browser from its frequency and the clock, so everyone on a station hears the same thing. Nothing is recorded.</footer>
</main>

<style>
	main { max-width: 780px; margin: 0 auto; padding: 28px 16px 60px; }
	header { text-align: center; margin-bottom: 22px; }
	h1 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: 0.02em; color: #f1e7d3; text-shadow: 0 1px 0 #000, 0 2px 8px rgba(0, 0, 0, 0.6); }
	header p { margin: 6px 0 0; color: #a2937a; font-style: italic; font-size: 14px; }

	.radio {
		border-radius: 26px; padding: 22px;
		background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 1px, rgba(0, 0, 0, 0.06) 1px 2px), linear-gradient(180deg, #dedede 0%, #bdbdbd 28%, #9d9d9d 62%, #c7c7c7 100%);
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.85), inset 0 -3px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.35), 0 30px 60px rgba(0, 0, 0, 0.65), 0 3px 6px rgba(0, 0, 0, 0.5);
	}
	.top { display: grid; grid-template-columns: 70px 1fr 70px; gap: 16px; margin-bottom: 18px; }
	.grille { border-radius: 12px; background-color: #6f6f6f; background-image: radial-gradient(circle at center, #171717 0 1.7px, transparent 2.1px); background-size: 7px 7px; box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 0 0 1px #333, 0 1px 0 rgba(255, 255, 255, 0.6); }
	.display {
		border-radius: 10px; padding: 12px 16px; min-height: 96px; color: #7bffb0;
		background: radial-gradient(ellipse at 50% 0%, #1a2b22, #0b1410 70%);
		box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.8), inset 0 0 0 2px #2c2a27, 0 1px 0 rgba(255, 255, 255, 0.6);
		font-family: "SF Mono", Menlo, Consolas, monospace; text-shadow: 0 0 6px rgba(120, 255, 170, 0.6);
	}
	.row1 { display: flex; align-items: baseline; gap: 10px; }
	.big { font-size: 40px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; }
	.unit { font-size: 14px; letter-spacing: 0.2em; }
	.call { font-size: 14px; letter-spacing: 0.25em; color: #a9ffcc; }
	.fill { flex: 1; }
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
	.power.on .led { background: radial-gradient(circle at 40% 35%, #b9ffcf, #12b04c); box-shadow: 0 0 10px rgba(40, 220, 100, 0.9); }
	.tuner { display: grid; justify-items: center; gap: 8px; }
	.plate { font-size: 10px; letter-spacing: 0.3em; color: #4a4a4a; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7); }
	.drawer { margin-top: 18px; }
	footer { margin-top: 26px; text-align: center; color: #7d705d; font-size: 12px; }

	@media (max-width: 640px) {
		.top { grid-template-columns: 1fr; }
		.grille { display: none; }
		.controls { grid-template-columns: 1fr 1fr; }
		.vu { grid-column: 1 / -1; max-width: none; }
		.radio { padding: 14px; }
		.big { font-size: 32px; }
	}
</style>
