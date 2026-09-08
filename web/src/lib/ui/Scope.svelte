<script lang="ts">
	import { onMount } from 'svelte';
	import { STEMS } from '../engine.js';
	import { activity, fader, set, COLORS } from '../mix.svelte';
	let { engine, playing }: { engine: { wave: (stem: string, out: Float32Array) => void } | null; playing: boolean } = $props();
	let canvas: HTMLCanvasElement;
	const stems = STEMS.map(([n]) => n).filter((n) => n !== 'reverb');

	onMount(() => {
		const g = canvas.getContext('2d')!, buf = new Float32Array(512);
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const W = canvas.width, H = canvas.height;
			g.globalCompositeOperation = 'source-over';
			g.fillStyle = 'rgba(3, 14, 8, 0.32)'; g.fillRect(0, 0, W, H);
			if (!engine || !playing) { for (const s of stems) activity[s] = (activity[s] ?? 0) * 0.9; return; }
			g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.5; g.shadowBlur = 9; g.lineJoin = 'round';
			for (const s of stems) {
				engine.wave(s, buf);
				let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
				const rms = Math.sqrt(e / buf.length);
				activity[s] = (activity[s] ?? 0) * 0.6 + rms * 0.4;
				if (rms < 0.003) continue;
				g.strokeStyle = COLORS[s]; g.shadowColor = COLORS[s]; g.globalAlpha = Math.min(0.9, 0.35 + rms * 4);
				g.beginPath();
				for (let i = 0; i < buf.length; i++) { const x = (i / (buf.length - 1)) * W, y = H / 2 - Math.max(-1, Math.min(1, buf[i] * 2.2)) * (H / 2 - 4); i ? g.lineTo(x, y) : g.moveTo(x, y); }
				g.stroke();
			}
			g.globalAlpha = 1; g.shadowBlur = 0;
		};
		draw();
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="crt">
	<canvas bind:this={canvas} width="1000" height="220"></canvas>
	<div class="glass"></div>
	<div class="legend">
		{#each stems as s}
			{@const f = fader(s)}
			<button style:color={COLORS[s]} style:opacity={f.mute ? 0.3 : 0.45 + 0.55 * Math.min(1, (activity[s] ?? 0) * 6)} class:muted={f.mute} onclick={() => set(s, { mute: !f.mute })} title={f.mute ? 'unmute' : 'mute'}>{s}</button>
		{/each}
	</div>
</div>

<style>
	.crt { position: relative; margin-top: 18px; border-radius: 14px; padding: 10px 12px 8px; background: #0a0f0c; box-shadow: inset 0 3px 14px rgba(0, 0, 0, 0.9), inset 0 0 0 2px #2c2a27, 0 1px 0 rgba(255, 255, 255, 0.55); overflow: hidden; }
	canvas {
		display: block; width: 100%; height: auto; border-radius: 8px;
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
</style>
