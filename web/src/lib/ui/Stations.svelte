<script lang="ts">
	import { stationName } from '../music/station.js';
	import { stationProfile } from '../music/style.js';
	import People from './People.svelte';
	type Person = { name: string; emoji: string };
	type Station = { id: number; listeners: number; lastHeard: number; people: Person[] };
	let { stations, me, current, onTune }: { stations: Station[]; me: Person | null; current: number; onTune: (id: number) => void } = $props();
	const onair = $derived(stations.filter((s) => s.listeners > 0));
	const heard = $derived(stations.filter((s) => s.listeners === 0));
	const band = Array.from({ length: 206 }, (_, i) => 875 + i);
	const ago = (t: number) => { const m = Math.max(1, Math.round((Date.now() / 1000 - t) / 60)); return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };
	// fade a list's edge only where there is more past it
	function edges(el: HTMLElement) {
		const update = () => {
			el.style.setProperty('--top', el.scrollTop > 2 ? '28px' : '0px');
			el.style.setProperty('--bot', el.scrollTop + el.clientHeight < el.scrollHeight - 2 ? '28px' : '0px');
		};
		const ro = new ResizeObserver(update), mo = new MutationObserver(update);
		ro.observe(el); mo.observe(el, { childList: true, subtree: true }); el.addEventListener('scroll', update, { passive: true }); update();
		return { destroy() { ro.disconnect(); mo.disconnect(); el.removeEventListener('scroll', update); } };
	}
</script>

<section class="panel">
	<h2><i class="led on"></i> On air</h2>
	{#if onair.length === 0}
		<p class="empty">Nobody is listening right now. Tune in and your station lights up for everyone.</p>
	{:else}
		<div class="list onair" use:edges>
			<ul>
				{#each onair as s (s.id)}
					{@const n = stationName(s.id)}
					<li class:current={s.id === current}><button onclick={() => onTune(s.id)}><b class="freq amber">{n.freq}</b><span class="tag">{stationProfile(s.id).groove}</span><span class="slogan">{n.slogan}</span></button><span class="who amber"><People people={s.people} {me} /></span></li>
				{/each}
			</ul>
		</div>
	{/if}
	<h2><i class="led"></i> Heard today</h2>
	<div class="list heard" use:edges>
		{#if heard.length === 0}
			<p class="empty">Nothing else yet today.</p>
		{:else}
			<ul>
				{#each heard as s (s.id)}
					{@const n = stationName(s.id)}
					<li class:current={s.id === current}><button onclick={() => onTune(s.id)}><b class="freq">{n.freq}</b><span class="tag">{stationProfile(s.id).groove}</span><span class="slogan">{n.slogan}</span></button><span class="who">{ago(s.lastHeard)}</span></li>
				{/each}
			</ul>
		{/if}
	</div>
	<h2>The whole band</h2>
	<div class="band" use:edges>
		{#each band as id}
			<button class:current={id === current} class:hot={onair.some((s) => s.id === id)} onclick={() => onTune(id)} title={stationProfile(id).groove}>{(id / 10).toFixed(1)}</button>
		{/each}
	</div>
</section>

<style>
	.panel {
		display: flex; flex-direction: column; min-height: 0; overflow: hidden; padding: 18px 20px 20px; border-radius: 22px; color: #e8dcc6;
		background-color: #33291f;
		background-image: repeating-radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.015) 0 2px, transparent 2px 5px), linear-gradient(180deg, #3b2f27, #2c231d);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.7), inset 0 -2px 0 rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.5);
	}
	h2 { display: flex; align-items: center; gap: 9px; margin: 16px 0 8px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #b9a98e; text-shadow: 0 1px 0 #000; }
	h2:first-child { margin-top: 0; }
	.led { width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #8a8a8a, #3a3a3a); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3); }
	.led.on { background: radial-gradient(circle at 40% 35%, #ffd27a, #ff8a00); box-shadow: 0 0 10px rgba(255, 150, 30, 0.9); }
	.empty { margin: 0; padding: 4px 2px; color: #9a8b73; font-size: 13px; }
	ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
	.list, .band { --row: 47px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #7a6248 rgba(0, 0, 0, 0.35); mask-image: linear-gradient(transparent, #000 var(--top, 0px), #000 calc(100% - var(--bot, 0px)), transparent); -webkit-mask-image: linear-gradient(transparent, #000 var(--top, 0px), #000 calc(100% - var(--bot, 0px)), transparent); }
	@supports selector(::-webkit-scrollbar) {
		.list, .band { scrollbar-width: auto; scrollbar-color: auto; }
		.list::-webkit-scrollbar, .band::-webkit-scrollbar { width: 8px; }
		.list::-webkit-scrollbar-track, .band::-webkit-scrollbar-track { border-radius: 4px; background: rgba(0, 0, 0, 0.35); box-shadow: inset 0 1px 2px #000; }
		.list::-webkit-scrollbar-thumb, .band::-webkit-scrollbar-thumb { border-radius: 4px; border: 1px solid #1a1410; background: linear-gradient(180deg, #8a6f52, #5c4634); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25); }
	}
	.onair { flex: none; max-height: calc(var(--row) * 4.5); }
	.heard { flex: 0 1 auto; max-height: calc(var(--row) * 6); }
	li { display: flex; align-items: center; margin-right: 4px; border: 1px solid #000; border-radius: 9px; background: linear-gradient(180deg, #4c3f34, #33291f); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 1px 0 rgba(0, 0, 0, 0.4); }
	li:hover { background: linear-gradient(180deg, #5a4a3d, #3b2f25); }
	li.current { box-shadow: inset 0 0 0 2px #ff9a1f, inset 0 1px 0 rgba(255, 255, 255, 0.14); }
	li button { flex: 1; min-width: 0; display: grid; grid-template-columns: 56px 60px 1fr; gap: 10px; align-items: baseline; text-align: left; padding: 9px 8px 9px 12px; border: 0; background: none; color: #e8dcc6; }
	.freq { font-size: 18px; font-variant-numeric: tabular-nums; }
	.tag { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #b9a98e; }
	.slogan { font-size: 13px; color: #d5c7ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.who { flex: none; padding-right: 12px; font-size: 12px; color: #9a8b73; white-space: nowrap; }
	.amber { color: #ffb347; text-shadow: 0 0 8px rgba(255, 150, 40, 0.5); }
	.band { flex: 1 1 0; min-height: 190px; display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); align-content: start; gap: 5px; padding: 2px; }
	.band button { padding: 6px 0; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid #000; border-radius: 6px; background: linear-gradient(180deg, #3d3229, #2a211b); color: #bfb09a; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1); }
	.band button.hot { color: #ffb347; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 8px rgba(255, 150, 40, 0.35); }
	.band button.current { color: #fff; box-shadow: inset 0 0 0 2px #ff9a1f; }
	@media (max-width: 1040px) { .heard { max-height: calc(var(--row) * 5.5); } .band { flex: none; max-height: 190px; } }
	@media (max-width: 640px) {
		.panel { padding: 14px 12px 14px; border-radius: 16px; }
		li button { grid-template-columns: 50px 1fr; gap: 8px; }
		.tag { display: none; }
		.band { grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); }
	}
</style>
