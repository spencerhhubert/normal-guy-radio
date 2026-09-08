<script lang="ts">
	import { stationName } from '../composer.js';
	type Station = { id: number; listeners: number; lastHeard: number };
	let { stations, current, onTune }: { stations: Station[]; current: number; onTune: (id: number) => void } = $props();
	const onair = $derived(stations.filter((s) => s.listeners > 0));
	const heard = $derived(stations.filter((s) => s.listeners === 0));
	const band = Array.from({ length: 206 }, (_, i) => 875 + i);
	const ago = (t: number) => { const m = Math.max(1, Math.round((Date.now() / 1000 - t) / 60)); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };
</script>

<section class="panel">
	<h2><i class="led on"></i> On air</h2>
	{#if onair.length === 0}
		<p class="empty">Nobody is listening right now. Tune in and your station lights up for everyone.</p>
	{:else}
		<ul>
			{#each onair as s (s.id)}
				{@const n = stationName(s.id)}
				<li class:current={s.id === current}><button onclick={() => onTune(s.id)}><b class="freq amber">{n.freq}</b><span class="call">{n.call}</span><span class="slogan">{n.slogan}</span><span class="who amber">{s.listeners} listening</span></button></li>
			{/each}
		</ul>
	{/if}
	{#if heard.length}
		<h2><i class="led"></i> Heard today</h2>
		<ul>
			{#each heard as s (s.id)}
				{@const n = stationName(s.id)}
				<li class:current={s.id === current}><button onclick={() => onTune(s.id)}><b class="freq">{n.freq}</b><span class="call">{n.call}</span><span class="slogan">{n.slogan}</span><span class="who">{ago(s.lastHeard)}</span></button></li>
			{/each}
		</ul>
	{/if}
	<h2>The whole band</h2>
	<div class="band">
		{#each band as id}
			<button class:current={id === current} class:hot={onair.some((s) => s.id === id)} onclick={() => onTune(id)}>{(id / 10).toFixed(1)}</button>
		{/each}
	</div>
</section>

<style>
	.panel { margin-top: 26px; padding: 18px 20px 22px; border-radius: 16px; background: linear-gradient(180deg, #3b2f27, #2c231d); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.6), 0 14px 30px rgba(0, 0, 0, 0.5); background-image: repeating-radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.015) 0 2px, transparent 2px 5px), linear-gradient(180deg, #3b2f27, #2c231d); }
	h2 { display: flex; align-items: center; gap: 9px; margin: 14px 0 8px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #b9a98e; text-shadow: 0 1px 0 #000; }
	h2:first-child { margin-top: 0; }
	.led { width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #8a8a8a, #3a3a3a); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3); }
	.led.on { background: radial-gradient(circle at 40% 35%, #ffd27a, #ff8a00); box-shadow: 0 0 10px rgba(255, 150, 30, 0.9); }
	.empty { margin: 0; color: #9a8b73; font-size: 13px; }
	ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
	li button { width: 100%; display: grid; grid-template-columns: 64px 62px 1fr auto; gap: 10px; align-items: baseline; text-align: left; padding: 9px 12px; border: 1px solid #000; border-radius: 9px; background: linear-gradient(180deg, #4c3f34, #33291f); color: #e8dcc6; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 1px 0 rgba(0, 0, 0, 0.4); }
	li button:hover { background: linear-gradient(180deg, #5a4a3d, #3b2f25); }
	li.current button { box-shadow: inset 0 0 0 2px #ff9a1f, inset 0 1px 0 rgba(255, 255, 255, 0.14); }
	.freq { font-size: 18px; font-variant-numeric: tabular-nums; }
	.call { font-size: 11px; letter-spacing: 0.15em; color: #b9a98e; }
	.slogan { font-size: 13px; color: #d5c7ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.who { font-size: 12px; color: #9a8b73; white-space: nowrap; }
	.amber { color: #ffb347; text-shadow: 0 0 8px rgba(255, 150, 40, 0.5); }
	.band { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 5px; }
	.band button { padding: 6px 0; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid #000; border-radius: 6px; background: linear-gradient(180deg, #3d3229, #2a211b); color: #bfb09a; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1); }
	.band button.hot { color: #ffb347; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 8px rgba(255, 150, 40, 0.35); }
	.band button.current { color: #fff; box-shadow: inset 0 0 0 2px #ff9a1f; }
</style>
