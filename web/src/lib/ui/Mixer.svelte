<script lang="ts">
	import { STEMS } from '../engine.js';
	import { activity, fader, set, reset, COLORS } from '../mix.svelte';
</script>

<div class="mixer">
	{#each STEMS as [name]}
		{@const f = fader(name)}
		{@const a = activity[name] ?? 0}
		<div class="stem" class:off={f.mute}>
			<i class="led" style:background={f.mute ? '#3a2a2a' : COLORS[name]} style:opacity={f.mute ? 0.5 : 0.25 + 0.75 * a} style:box-shadow="0 0 {2 + 12 * a}px {COLORS[name]}"></i>
			<span class="name">{name}</span>
			<input type="range" min="0" max="1.5" step="0.01" value={f.level} oninput={(e) => set(name, { level: parseFloat(e.currentTarget.value) })} ondblclick={() => set(name, { level: 1 })} aria-label="{name} level" />
			<button class="mute" class:on={f.mute} onclick={() => set(name, { mute: !f.mute })} aria-label="mute {name}" aria-pressed={f.mute}>M</button>
		</div>
	{/each}
	<button class="reset" onclick={reset}>reset</button>
</div>

<style>
	.mixer { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px 22px; padding: 16px 18px 14px; background: linear-gradient(180deg, #1b1916, #262220); border-radius: 12px; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.7), inset 0 0 0 1px #000, 0 1px 0 rgba(255, 255, 255, 0.35); }
	.stem { display: flex; align-items: center; gap: 10px; }
	.led { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; transition: opacity 80ms linear, box-shadow 80ms linear; }
	.name { flex: 0 0 92px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #cbbfa8; text-shadow: 0 1px 0 #000; }
	.off .name { color: #6f665a; text-decoration: line-through; }
	.mute { width: 22px; height: 20px; padding: 0; font-size: 10px; font-weight: 700; border-radius: 4px; border: 1px solid #000; color: #cbbfa8; background: linear-gradient(180deg, #4a443d, #2b2724); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2); flex: 0 0 auto; }
	.mute.on { color: #fff; background: linear-gradient(180deg, #ff6a3d, #b8230f); box-shadow: 0 0 8px rgba(255, 90, 40, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.4); }
	input[type='range'] { flex: 1; -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; background: linear-gradient(180deg, #0c0c0c, #262626); box-shadow: inset 0 1px 3px #000, 0 1px 0 rgba(255, 255, 255, 0.12); }
	input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cfcfcf 30%, #8a8a8a 70%, #5b5b5b); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.9); border: 1px solid #333; }
	input[type='range']::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cfcfcf 30%, #8a8a8a 70%, #5b5b5b); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.7); border: 1px solid #333; }
	.reset { grid-column: 1 / -1; justify-self: end; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #cbbfa8; background: linear-gradient(180deg, #4a443d, #2b2724); border: 1px solid #000; border-radius: 6px; padding: 4px 12px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2); }
</style>
