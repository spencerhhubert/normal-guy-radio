<script lang="ts">
	type Person = { name: string; emoji: string };
	let { people, me = null, max = 4 }: { people: Person[]; me?: Person | null; max?: number } = $props();
	let open = $state(false), at = $state({ top: 0, right: 0 });
	let root = $state<HTMLElement>();
	const shown = $derived(people.slice(0, max));
	function toggle() {
		if (!open && root) { const r = root.getBoundingClientRect(); at = { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }; }
		open = !open;
	}
	function away(e: MouseEvent) { if (open && root && !root.contains(e.target as Node)) open = false; }
</script>

<svelte:window onclick={away} onscrollcapture={() => (open = false)} />
<span class="people" bind:this={root}>
	<button onclick={toggle} title={people.map((p) => p.name).join(', ')} aria-expanded={open}>
		{#each shown as p (p.name)}<i>{p.emoji}</i>{/each}
		{#if people.length > shown.length}<em>+{people.length - shown.length}</em>{/if}
		<span class="n">{people.length} listening</span>
	</button>
	{#if open}
		<ul style:top="{at.top}px" style:right="{at.right}px">
			{#each people as p (p.name)}<li><i>{p.emoji}</i>{p.name}{#if me && p.name === me.name}<b>you</b>{/if}</li>{/each}
			{#if people.length === 0}<li class="none">Nobody yet</li>{/if}
		</ul>
	{/if}
</span>

<style>
	.people { display: inline-flex; }
	button { display: inline-flex; align-items: center; background: none; border: 0; padding: 0; color: inherit; font: inherit; letter-spacing: inherit; text-shadow: inherit; }
	i { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: -6px; border-radius: 50%; font-style: normal; font-size: 12px; line-height: 1; background: rgba(0, 0, 0, 0.5); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18); }
	em { margin-left: 9px; font-style: normal; font-size: 11px; }
	.n { margin-left: 12px; white-space: nowrap; }
	ul { position: fixed; z-index: 9; margin: 0; padding: 6px 0; list-style: none; min-width: 200px; max-height: 60vh; overflow: auto; border-radius: 9px; border: 1px solid #000; background: linear-gradient(180deg, #3b2f27, #2c231d); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 30px rgba(0, 0, 0, 0.6); color: #e8dcc6; font: 13px/1.3 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; letter-spacing: 0; text-shadow: none; text-transform: none; text-align: left; }
	li { display: flex; align-items: center; gap: 9px; padding: 6px 14px; white-space: nowrap; }
	li i { margin: 0; width: 22px; height: 22px; font-size: 13px; }
	li b { margin-left: auto; padding-left: 12px; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #ffb347; }
	.none { color: #9a8b73; }
</style>
