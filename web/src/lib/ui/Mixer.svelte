<script lang="ts">
	import { STEMS } from '../engine.js';
	let { engine }: { engine: { setLevel: (name: string, v: number) => void } | null } = $props();
	type Fader = { level: number; mute: boolean };
	let mix = $state<Record<string, Fader>>(read());
	function read(): Record<string, Fader> { try { return JSON.parse(localStorage.getItem('ngr.mix') || '{}'); } catch { return {}; } }
	function fader(name: string): Fader { return mix[name] ?? { level: 1, mute: false }; }
	function apply(name: string) {
		const f = fader(name);
		for (const strip of STEMS.find(([n]) => n === name)![1]) engine?.setLevel(strip, f.mute ? 0 : f.level);
		try { localStorage.setItem('ngr.mix', JSON.stringify(mix)); } catch {}
	}
	function set(name: string, patch: Partial<Fader>) { mix[name] = { ...fader(name), ...patch }; apply(name); }
	$effect(() => { if (engine) for (const [name] of STEMS) apply(name); });
</script>

<div class="mixer">
	{#each STEMS as [name]}
		{@const f = fader(name)}
		<div class="stem" class:off={f.mute}>
			<button class="mute" class:on={f.mute} onclick={() => set(name, { mute: !f.mute })} aria-label="mute {name}"></button>
			<span class="name">{name}</span>
			<input type="range" min="0" max="1.5" step="0.01" value={f.level} oninput={(e) => set(name, { level: parseFloat(e.currentTarget.value) })} ondblclick={() => set(name, { level: 1 })} aria-label="{name} level" />
		</div>
	{/each}
	<button class="reset" onclick={() => { mix = {}; for (const [name] of STEMS) apply(name); }}>reset</button>
</div>

<style>
	.mixer { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px 22px; padding: 16px 18px 14px; background: linear-gradient(180deg, #1b1916, #262220); border-radius: 12px; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.7), inset 0 0 0 1px #000, 0 1px 0 rgba(255, 255, 255, 0.35); }
	.stem { display: flex; align-items: center; gap: 10px; }
	.name { flex: 0 0 92px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #cbbfa8; text-shadow: 0 1px 0 #000; }
	.off .name { color: #6f665a; text-decoration: line-through; }
	.mute { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #000; background: radial-gradient(circle at 40% 35%, #6a6a6a, #2a2a2a); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 1px 0 rgba(255, 255, 255, 0.15); padding: 0; flex: 0 0 auto; }
	.mute.on { background: radial-gradient(circle at 40% 35%, #ff6a3d, #b8230f); box-shadow: 0 0 8px rgba(255, 90, 40, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.5); }
	input[type='range'] { flex: 1; -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; background: linear-gradient(180deg, #0c0c0c, #262626); box-shadow: inset 0 1px 3px #000, 0 1px 0 rgba(255, 255, 255, 0.12); }
	input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cfcfcf 30%, #8a8a8a 70%, #5b5b5b); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.9); border: 1px solid #333; }
	input[type='range']::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cfcfcf 30%, #8a8a8a 70%, #5b5b5b); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.7); border: 1px solid #333; }
	.reset { grid-column: 1 / -1; justify-self: end; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #cbbfa8; background: linear-gradient(180deg, #4a443d, #2b2724); border: 1px solid #000; border-radius: 6px; padding: 4px 12px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2); }
</style>
