<script lang="ts">
	let { level = 0 }: { level?: number } = $props();
	const angle = $derived(-42 + 84 * Math.min(1, level));
</script>

<div class="vu">
	<svg viewBox="0 0 200 120">
		<defs><linearGradient id="vuface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efdc" /><stop offset="1" stop-color="#dccfa9" /></linearGradient></defs>
		<rect width="200" height="120" rx="8" fill="url(#vuface)" />
		<path d="M 30 96 A 80 80 0 0 1 170 96" fill="none" stroke="#3a3126" stroke-width="3" />
		<path d="M 139 55 A 80 80 0 0 1 170 96" fill="none" stroke="#d1332c" stroke-width="5" />
		{#each [-42, -28, -14, 0, 14, 28, 42] as a, i}
			<line x1="100" y1="22" x2="100" y2="30" stroke="#3a3126" stroke-width="2" transform="rotate({a} 100 100)" />
			<text x="100" y="18" text-anchor="middle" transform="rotate({a} 100 100)" class="t">{['-20', '-10', '-5', '-3', '0', '+1', '+3'][i]}</text>
		{/each}
		<text x="100" y="80" text-anchor="middle" class="vu-label">VU</text>
		<g transform="rotate({angle} 100 100)" style="transition: transform 90ms linear">
			<line x1="100" y1="100" x2="100" y2="24" stroke="#1d1712" stroke-width="2.2" />
		</g>
		<circle cx="100" cy="100" r="7" fill="#2b2b2b" />
		<rect width="200" height="120" rx="8" fill="url(#glass)" />
	</svg>
</div>

<style>
	.vu { border-radius: 8px; box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.55), inset 0 0 0 2px #3b352e; overflow: hidden; }
	svg { display: block; width: 100%; height: auto; }
	.t { font: 700 9px/1 Helvetica, Arial, sans-serif; fill: #3a3126; }
	.vu-label { font: 800 18px/1 Helvetica, Arial, sans-serif; fill: #6b5e4a; letter-spacing: 0.1em; }
</style>
