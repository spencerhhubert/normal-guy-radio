<script lang="ts">
	let { value, onStep }: { value: number; onStep: (delta: number) => void } = $props();
	let el: HTMLDivElement, last = 0, acc = 0;
	const angleAt = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
	function down(e: PointerEvent) { el.setPointerCapture(e.pointerId); last = angleAt(e); acc = 0; }
	function move(e: PointerEvent) {
		if (!el.hasPointerCapture(e.pointerId)) return;
		const a = angleAt(e);
		let d = a - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
		last = a; acc += d;
		const steps = Math.trunc(acc / (Math.PI / 30));
		if (steps) { onStep(steps); acc -= steps * (Math.PI / 30); }
	}
</script>

<div class="knob" bind:this={el} style:transform="rotate({value * 6}deg)" onpointerdown={down} onpointermove={move} onwheel={(e) => { e.preventDefault(); onStep(Math.sign(e.deltaY)); }} role="slider" aria-label="tuning" aria-valuenow={value / 10} tabindex="0" onkeydown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onStep(-1); if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onStep(1); }}>
	<div class="cap"><i></i></div>
</div>

<style>
	.knob {
		width: 118px; height: 118px; border-radius: 50%; touch-action: none; cursor: grab; position: relative;
		background: repeating-conic-gradient(from 0deg, #cfcfcf 0 3deg, #7a7a7a 3deg 6deg);
		box-shadow: 0 10px 18px rgba(0, 0, 0, 0.55), 0 2px 3px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(0, 0, 0, 0.5);
	}
	.knob:active { cursor: grabbing; }
	.knob:focus-visible { outline: 2px solid #ff9a1f; outline-offset: 3px; }
	.cap {
		position: absolute; inset: 12px; border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #ffffff 0%, #dcdcdc 25%, #9c9c9c 60%, #6e6e6e 100%);
		box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0, 0, 0, 0.6);
	}
	.cap i { position: absolute; left: 50%; top: 8px; width: 6px; height: 26px; margin-left: -3px; border-radius: 3px; background: #2b2b2b; box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 1px 1px rgba(255, 255, 255, 0.6); }
</style>
