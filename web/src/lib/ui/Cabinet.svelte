<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<!-- one cabinet: the control face on the left, the station selector on the right, both the same height -->
<main><div class="cabinet">{@render children()}</div></main>

<style>
	main { max-width: 1400px; margin: 0 auto; padding: 28px 16px 60px; }
	.cabinet {
		display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr); gap: 18px; padding: 22px; border-radius: 36px;
		background-color: #1c1714;
		background-image: repeating-radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.03) 0 1.5px, transparent 1.5px 4px), linear-gradient(180deg, #2c2520, #16120f);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 0 0 5px #0b0907, inset 0 0 0 6px rgba(255, 255, 255, 0.22), inset 0 0 0 8px #0b0907, 0 40px 80px rgba(0, 0, 0, 0.7), 0 4px 10px rgba(0, 0, 0, 0.6);
	}
	@media (max-width: 1040px) { main { max-width: 780px; } .cabinet { grid-template-columns: 1fr; } }
	@media (max-width: 640px) {
		main { padding: 10px 8px 40px; }
		.cabinet { gap: 10px; padding: 12px; border-radius: 24px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 0 0 3px #0b0907, inset 0 0 0 4px rgba(255, 255, 255, 0.22), inset 0 0 0 5px #0b0907, 0 20px 40px rgba(0, 0, 0, 0.7); }
	}
</style>
