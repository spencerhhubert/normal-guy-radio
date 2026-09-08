<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { stationName } from '$lib/music/station.js';
	import { radio, tuneIn, stop, retune, syncClock } from '$lib/radio.svelte';
	import { presence, refresh, beat, leave, move } from '$lib/presence.svelte';
	import { useStation, param } from '$lib/mix.svelte';
	import Cabinet from '$lib/ui/Cabinet.svelte';
	import Face from '$lib/ui/Face.svelte';
	import Stations from '$lib/ui/Stations.svelte';

	const LO = 875, HI = 1080;
	let freq = $state(1013);
	let power = $state(true);
	let mixerOpen = $state(false);
	let level = $state(0);
	const name = $derived(stationName(freq));
	const onair = $derived(new Map(presence.stations.filter((s) => s.listeners > 0).map((s) => [s.id, s.listeners])));
	const recent = $derived(new Set(presence.stations.filter((s) => s.listeners === 0).map((s) => s.id)));
	const status = $derived(radio.loading || (radio.now ? `${radio.now.cue} · ${radio.now.section}` : power && radio.engine && !radio.playing ? 'tap anywhere to start' : power ? 'tuning…' : 'standby'));
	const url = () => `?fm=${(freq / 10).toFixed(1)}` + (param() ? `&mix=${param()}` : '');

	async function start() {
		if (!(await tuneIn(() => freq))) return;
		if (power) beat(freq); else stop();
	}
	function tune(id: number) {
		id = Math.min(HI, Math.max(LO, id));
		if (id === freq) return;
		const from = freq;
		freq = id;
		useStation(id);
		history.replaceState(null, '', url());
		if (power) { move(from, id); beat(id); retune(() => freq); }
	}
	function toggle() {
		power = !power;
		if (power) start(); else { stop(); leave(freq); }
	}
	function kick(e: Event) {
		if ((e.target as HTMLElement).closest?.('.power')) return;
		if (power && !radio.playing) start();
	}

	onMount(() => {
		const params = new URLSearchParams(location.search), fm = parseFloat(params.get('fm') || '');
		if (fm) freq = Math.min(HI, Math.max(LO, Math.round(fm * 10)));
		useStation(freq, params.get('mix'));
		$effect.root(() => { $effect(() => { const u = url(); if (location.search !== u) history.replaceState(null, '', u); }); });
		syncClock(); refresh(); start();
		const timers = [setInterval(refresh, 5000), setInterval(syncClock, 300000), setInterval(() => { if (power) beat(freq); }, 10000)];
		window.addEventListener('click', kick); window.addEventListener('keydown', kick);
		const bye = () => { if (power) leave(freq); };
		window.addEventListener('pagehide', bye);
		const buf = new Uint8Array(512);
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			if (!radio.engine || !radio.playing) { level *= 0.9; return; }
			radio.engine.analyser.getByteTimeDomainData(buf);
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

<Cabinet>
	<Face {freq} {name} silent={radio.silent} me={presence.me} {status} chord={radio.now?.chord ?? ''} {power} playing={radio.playing} {level} engine={radio.engine} {onair} {recent} onTune={tune} onToggle={toggle} />
	<Stations stations={presence.stations} me={presence.me} current={freq} onTune={tune} />
</Cabinet>
