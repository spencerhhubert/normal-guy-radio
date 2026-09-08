<script lang="ts">
	import Dial from './Dial.svelte';
	import Knob from './Knob.svelte';
	import VuMeter from './VuMeter.svelte';
	import Mixer from './Mixer.svelte';
	import Scope from './Scope.svelte';
	type Person = { name: string; emoji: string };
	let { freq, name, silent = false, me = null, status, chord = '', power, playing, level, engine, onair, recent, onTune, onToggle }: {
		freq: number; name: { freq: string; call: string; slogan: string }; silent?: boolean; me?: Person | null; status: string; chord?: string;
		power: boolean; playing: boolean; level: number; engine: { wave: (stem: string, out: Float32Array) => void } | null;
		onair: Map<number, number>; recent: Set<number>; onTune: (id: number) => void; onToggle: () => void;
	} = $props();
	let mixerOpen = $state(false);
</script>

<div class="radio">
	<div class="top">
		<div class="grille"></div>
		<div class="display">
			<div class="row1"><span class="big">{name.freq}</span><span class="unit">FM</span><span class="call">{name.call}</span>{#if silent}<span class="hush">silent</span>{/if}<span class="fill"></span>{#if me}<span class="me">{me.emoji} {me.name}</span>{/if}</div>
			<div class="row2">{name.slogan}</div>
			<div class="row3">{status}{#if chord}{' · '}<b>{chord}</b>{/if}</div>
		</div>
		<div class="grille"></div>
	</div>

	<Dial {freq} {onair} {recent} {onTune} />
	<Scope {engine} {playing} />

	<div class="controls">
		<div class="vu"><VuMeter {level} /></div>
		<div class="buttons">
			<button class="btn power" class:on={power} class:live={playing} onclick={onToggle} aria-pressed={power}><i class="led"></i>Power</button>
			<button class="btn" class:on={mixerOpen} onclick={() => (mixerOpen = !mixerOpen)} aria-pressed={mixerOpen}>Mixer</button>
		</div>
		<div class="tuner"><Knob value={freq} onStep={(d) => onTune(freq + d)} /><span class="plate">TUNE</span></div>
	</div>

	{#if mixerOpen}<div class="drawer"><Mixer /></div>{/if}
</div>

<style>
	.radio {
		container-type: inline-size; min-width: 0; border-radius: 22px; padding: 22px;
		background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 1px, rgba(0, 0, 0, 0.06) 1px 2px), linear-gradient(180deg, #dedede 0%, #bdbdbd 28%, #9d9d9d 62%, #c7c7c7 100%);
		box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.85), inset 0 -3px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.6);
	}
	.top { display: grid; grid-template-columns: 70px minmax(0, 1fr) 70px; gap: 16px; margin-bottom: 18px; }
	/* the grilles are decoration; a narrow face gives their room to the display */
	@container (max-width: 760px) { .top { grid-template-columns: minmax(0, 1fr); } .grille { display: none; } }
	.grille { border-radius: 12px; background-color: #6f6f6f; background-image: radial-gradient(circle at center, #171717 0 1.7px, transparent 2.1px); background-size: 7px 7px; box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 0 0 1px #333, 0 1px 0 rgba(255, 255, 255, 0.6); }
	.display {
		min-width: 0; overflow: hidden; border-radius: 10px; padding: 12px 16px; min-height: 96px; color: #7bffb0;
		background: radial-gradient(ellipse at 50% 0%, #1a2b22, #0b1410 70%);
		box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.8), inset 0 0 0 2px #2c2a27, 0 1px 0 rgba(255, 255, 255, 0.6);
		font-family: "SF Mono", Menlo, Consolas, monospace; text-shadow: 0 0 6px rgba(120, 255, 170, 0.6);
	}
	.row1 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 10px; }
	.big { font-size: 40px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; }
	.unit { font-size: 14px; letter-spacing: 0.2em; }
	.call { font-size: 14px; letter-spacing: 0.25em; color: #a9ffcc; }
	.hush { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #ff6b6b; text-shadow: 0 0 8px rgba(255, 80, 80, 0.7); }
	.fill { flex: 1; }
	.me { font-size: 12px; letter-spacing: 0.06em; color: #ffb347; text-shadow: 0 0 8px rgba(255, 150, 40, 0.5); white-space: nowrap; }
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
	.power.on .led { background: radial-gradient(circle at 40% 35%, #ffe2a8, #d98a00); box-shadow: 0 0 8px rgba(255, 170, 40, 0.8); }
	.power.live .led { background: radial-gradient(circle at 40% 35%, #b9ffcf, #12b04c); box-shadow: 0 0 10px rgba(40, 220, 100, 0.9); }
	.tuner { display: grid; justify-items: center; gap: 8px; }
	.plate { font-size: 10px; letter-spacing: 0.3em; color: #4a4a4a; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7); }
	.drawer { margin-top: 18px; }

	@media (max-width: 640px) {
		.radio { padding: 12px; border-radius: 16px; }
		.top { margin-bottom: 12px; }
		.display { padding: 10px 12px; min-height: 0; }
		.big { font-size: 30px; }
		.row3 { white-space: normal; }
		.controls { grid-template-columns: 1fr auto; gap: 12px 16px; margin-top: 14px; }
		.vu { max-width: 170px; }
		.buttons { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; }
	}
</style>
