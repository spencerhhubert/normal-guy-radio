<script lang="ts">
	import { onMount } from 'svelte';
	import { STEMS } from '../engine.js';
	import { activity, fader, set, COLORS } from '../mix.svelte';
	let { engine, playing }: { engine: { wave: (stem: string, out: Float32Array) => void } | null; playing: boolean } = $props();
	let canvas: HTMLCanvasElement;
	const stems = STEMS.map(([n]) => n), lanes = stems.filter((n) => n !== 'reverb');
	const N = 1024, SPAN = (N * 3) / 4;

	onMount(() => {
		const g = canvas.getContext('2d')!, dpr = Math.min(2, devicePixelRatio || 1);
		const bufs = Object.fromEntries(stems.map((s) => [s, new Float32Array(N)]));
		const peak: Record<string, number> = {}, ref: Record<string, number> = {}, loud: Record<string, number> = {}, lane: Record<string, number> = {};
		const size = () => { canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr); };
		const ro = new ResizeObserver(size); ro.observe(canvas); size();
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const W = canvas.width / dpr, H = canvas.height / dpr;
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.shadowBlur = 0;
			g.fillStyle = 'rgba(3, 14, 8, 0.32)'; g.fillRect(0, 0, W, H);
			if (!engine || !playing) { for (const s of stems) activity[s] = (activity[s] ?? 0) * 0.9; return; }
			const live: string[] = [];
			for (const s of stems) {
				const w = bufs[s]; engine.wave(s, w);
				let e = 0, p = 0;
				for (let i = 0; i < N; i++) { const x = w[i], a = x < 0 ? -x : x; e += x * x; if (a > p) p = a; }
				const rms = Math.sqrt(e / N);
				loud[s] = (loud[s] ?? 0) * 0.6 + rms * 0.4;
				peak[s] = Math.max(p, (peak[s] ?? 0) * 0.97, 0.02);
				ref[s] = Math.max(p, (ref[s] ?? 0) * 0.995, 0.02);
				activity[s] = (activity[s] ?? 0) * 0.5 + Math.min(1, (1.6 * rms) / ref[s]) * 0.5;
				if (s !== 'reverb' && loud[s] > 0.002) live.push(s); else delete lane[s];
			}
			// one lane per sounding stem, stacked like a multi-channel scope; each trace is scaled to its own recent peak,
			// and the activity that lights the legend and the mixer is relative to the stem's own recent loudness
			const n = live.length, amp = Math.min(0.3, 0.7 / Math.max(1, n)) * H;
			g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.4; g.lineJoin = 'round'; g.font = '700 10px "SF Mono", Menlo, Consolas, monospace';
			live.forEach((s, i) => {
				const target = ((i + 0.5) / n) * H, cy = (lane[s] = lane[s] == null ? target : lane[s] + (target - lane[s]) * 0.15);
				const w = bufs[s], gain = 1 / peak[s];
				let t = 0; for (let k = 1; k < N - SPAN; k++) if (w[k - 1] < 0 && w[k] >= 0) { t = k; break; }
				g.strokeStyle = g.fillStyle = g.shadowColor = COLORS[s];
				g.globalAlpha = 0.55; g.shadowBlur = 0; g.fillText(s.toUpperCase(), 8, cy + 3.5);
				g.globalAlpha = 0.5 + activity[s] * 0.45; g.shadowBlur = 8;
				g.beginPath();
				for (let k = 0; k < SPAN; k += 2) { const x = (k / (SPAN - 1)) * W, y = cy - Math.max(-1, Math.min(1, w[t + k] * gain)) * amp; k ? g.lineTo(x, y) : g.moveTo(x, y); }
				g.stroke();
			});
		};
		draw();
		return () => { cancelAnimationFrame(raf); ro.disconnect(); };
	});
</script>

<div class="crt">
	<canvas bind:this={canvas}></canvas>
	<div class="glass"></div>
	<div class="legend">
		{#each lanes as s}
			{@const f = fader(s)}
			<button style:color={COLORS[s]} style:opacity={f.mute ? 0.3 : 0.45 + 0.55 * (activity[s] ?? 0)} class:muted={f.mute} onclick={() => set(s, { mute: !f.mute })} title={f.mute ? 'unmute' : 'mute'}>{s}</button>
		{/each}
	</div>
</div>

<style>
	.crt { position: relative; margin-top: 18px; border-radius: 14px; padding: 10px 12px 8px; background: #0a0f0c; box-shadow: inset 0 3px 14px rgba(0, 0, 0, 0.9), inset 0 0 0 2px #2c2a27, 0 1px 0 rgba(255, 255, 255, 0.55); overflow: hidden; }
	canvas {
		display: block; width: 100%; height: 230px; border-radius: 8px;
		background-color: #041009;
		background-image: linear-gradient(rgba(120, 255, 170, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 255, 170, 0.07) 1px, transparent 1px), radial-gradient(ellipse at center, rgba(40, 120, 70, 0.25), transparent 70%);
		background-size: 10% 25%, 10% 25%, 100% 100%;
	}
	.glass { position: absolute; inset: 10px 12px 8px; pointer-events: none; border-radius: 8px;
		background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px), linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02) 40%, transparent 55%);
		box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.7); }
	.legend { display: flex; flex-wrap: wrap; gap: 2px 10px; padding: 8px 4px 0; }
	.legend button { background: none; border: 0; padding: 0; font: 700 10px/1.6 "SF Mono", Menlo, Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; text-shadow: 0 0 6px currentColor; transition: opacity 80ms linear; }
	.legend button.muted { text-decoration: line-through; text-shadow: none; }
	@media (max-width: 640px) { canvas { height: 170px; } }
</style>
