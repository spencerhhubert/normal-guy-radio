<script lang="ts">
	let { freq, onair = new Map<number, number>(), recent = new Set<number>(), onTune }: { freq: number; onair?: Map<number, number>; recent?: Set<number>; onTune: (id: number) => void } = $props();
	const LO = 875, HI = 1080, W = 1000, PAD = 40;
	const x = (id: number) => PAD + ((id - LO) / (HI - LO)) * (W - 2 * PAD);
	const ticks = Array.from({ length: (HI - LO) / 5 + 1 }, (_, i) => LO + i * 5);
	let svg: SVGSVGElement, dragging = $state(false);
	function tuneAt(e: PointerEvent) {
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		onTune(Math.round(Math.min(HI, Math.max(LO, LO + ((px - PAD) / (W - 2 * PAD)) * (HI - LO)))));
	}
</script>

<div class="window">
	<svg bind:this={svg} viewBox="0 0 {W} 190" role="slider" aria-label="tuning dial" aria-valuenow={freq / 10} aria-valuemin={LO / 10} aria-valuemax={HI / 10} tabindex="-1" onpointerdown={(e) => { dragging = true; svg.setPointerCapture(e.pointerId); tuneAt(e); }} onpointermove={(e) => dragging && tuneAt(e)} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
		<defs>
			<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ead4" /><stop offset="1" stop-color="#d9cca8" /></linearGradient>
			<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45" /><stop offset="0.45" stop-color="#fff" stop-opacity="0.06" /><stop offset="0.5" stop-color="#fff" stop-opacity="0" /></linearGradient>
			<filter id="needleShadow"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-opacity="0.45" /></filter>
		</defs>
		<rect width={W} height="190" fill="url(#face)" />
		<text x={PAD} y="34" class="label">FM</text>
		<text x={W - PAD} y="34" class="label" text-anchor="end">MHz</text>
		{#each ticks as t}
			{@const major = t % 20 === 0}
			<line x1={x(t)} x2={x(t)} y1={major ? 62 : 78} y2="96" stroke="#3a3126" stroke-width={major ? 2.5 : 1.2} />
			{#if major}<text x={x(t)} y="54" text-anchor="middle" class="num">{t / 10}</text>{/if}
		{/each}
		<line x1={PAD} x2={W - PAD} y1="96" y2="96" stroke="#3a3126" stroke-width="2" />
		{#each [...recent] as id}
			{#if !onair.has(id)}<circle cx={x(id)} cy="118" r="4.5" fill="#b3a58a" />{/if}
		{/each}
		{#each [...onair] as [id, n]}
			<circle cx={x(id)} cy="118" r="7" fill="#ff9a1f" filter="url(#needleShadow)" />
			<circle cx={x(id)} cy="118" r="11" fill="none" stroke="#ff9a1f" stroke-opacity="0.35" stroke-width="3" />
			<text x={x(id)} y="150" text-anchor="middle" class="count">{n}</text>
		{/each}
		<g transform="translate({x(freq)} 0)" filter="url(#needleShadow)">
			<rect x="-2" y="42" width="4" height="120" rx="2" fill="#d1332c" />
			<rect x="-1" y="42" width="1" height="120" fill="#ff8a80" opacity="0.7" />
		</g>
		<rect width={W} height="190" fill="url(#glass)" pointer-events="none" />
	</svg>
</div>

<style>
	.window { border-radius: 10px; overflow: hidden; box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.55), inset 0 0 0 2px #3b352e, 0 1px 0 rgba(255, 255, 255, 0.55); background: #111; touch-action: none; }
	svg { display: block; width: 100%; height: auto; cursor: crosshair; }
	.label { font: 700 22px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; fill: #6b5e4a; letter-spacing: 0.15em; }
	.num { font: 700 26px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; fill: #2f2820; }
	.count { font: 700 22px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; fill: #b35a00; }
</style>
