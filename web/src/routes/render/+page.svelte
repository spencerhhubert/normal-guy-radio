<script lang="ts">
	import { onMount } from 'svelte';
	import { loadSamples } from '$lib/samples';
	import { renderOffline } from '$lib/audio/render.js';

	let status = $state('rendering');
	onMount(async () => {
		const q = new URLSearchParams(location.search);
		const station = parseInt(q.get('station') || '1013', 10), at = parseFloat(q.get('at') || '0'), secs = parseFloat(q.get('secs') || '90');
		const name = q.get('name') || `station${station}-${secs}s`;
		const samples = await loadSamples();
		const { wav, log } = await renderOffline(samples, station, at, secs, (p: number) => (status = `rendering ${Math.round(p * 100)}%`));
		await fetch('/dev/render', { method: 'POST', headers: { 'X-Name': name }, body: wav });
		await fetch('/dev/render', { method: 'POST', headers: { 'X-Name': name, 'Content-Type': 'application/json' }, body: JSON.stringify(log) });
		status = 'done';
		(window as unknown as { __renderDone: boolean }).__renderDone = true;
	});
</script>

<p style="font-family: monospace; padding: 20px; color: #ddd">{status}</p>
