<script lang="ts">
	import Cabinet from '$lib/ui/Cabinet.svelte';
	import Face from '$lib/ui/Face.svelte';
	import Stations from '$lib/ui/Stations.svelte';
	import { stationName } from '$lib/music/station.js';

	// the share image: the cabinet with a fixed station, a fixed roster, and a scope drawn from steady waves, so it renders the same every time and needs no audio
	const freq = 1013, name = stationName(freq), now = Math.floor(Date.now() / 1000);
	const P = (name: string, emoji: string) => ({ name, emoji });
	const me = P('Whistling Otter', '🦦');
	const stations = [
		{ id: 1013, listeners: 3, lastHeard: now, people: [me, P('Grooving Fox', '🦊'), P('Dozing Sloth', '🦥')] },
		{ id: 970, listeners: 2, lastHeard: now, people: [P('Tapping Penguin', '🐧'), P('Humming Whale', '🐳')] },
		{ id: 929, listeners: 1, lastHeard: now, people: [P('Waltzing Flamingo', '🦩')] },
		...[1044, 883, 961, 888, 951, 1067].map((id, i) => ({ id, listeners: 0, lastHeard: now - 240 * (i + 1), people: [] })),
	];
	const onair = new Map(stations.filter((s) => s.listeners).map((s) => [s.id, s.listeners])), recent = new Set(stations.filter((s) => !s.listeners).map((s) => s.id));
	const noise = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1) - 0.5;
	const shapes: Record<string, (i: number, t: number) => number> = {
		bass: (i, t) => 0.8 * Math.sin(i / 130 + t),
		whistle: (i, t) => 0.6 * Math.sin(i / 11 + 3 * t) * (0.8 + 0.2 * Math.sin(i / 90)),
		wurly: (i, t) => 0.4 * (Math.sin(i / 33 + t) + 0.5 * Math.sin(i / 16.5 + 2 * t)),
		strings: (i, t) => 0.5 * (((i / 44 + t) % 2) - 1),
		drums: (i, t) => 0.9 * Math.exp(-((i + t * 400) % 700) / 120) * noise(i),
		shaker: (i) => 0.3 * noise(i * 7),
	};
	let frame = 0;
	const engine = { wave(stem: string, out: Float32Array) { const f = shapes[stem], t = frame++ / 700; for (let i = 0; i < out.length; i++) out[i] = f ? f(i, t) : 0; } };
</script>

<div class="og">
	<div class="fit">
		<Cabinet>
			<Face {freq} {name} {me} status="C · I IV I V · 110 bpm 4/4 · funk · sweet · A 3/8 · whistle" chord="F" power playing level={0.62} {engine} {onair} {recent} onTune={() => {}} onToggle={() => {}} />
			<Stations {stations} {me} current={freq} onTune={() => {}} />
		</Cabinet>
	</div>
</div>

<style>
	:global(html, body) { overflow: hidden; }
	.og { width: 1200px; height: 630px; overflow: hidden; }
	.fit { zoom: 0.73; }
	.fit :global(main) { padding: 10px 16px; }
</style>
