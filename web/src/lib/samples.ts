import { INSTRUMENTS } from './engine.js';

export type Samples = Record<string, Record<string, string>>;

export async function loadSamples(onProgress?: (done: number, total: number) => void): Promise<Samples> {
	const names = Object.keys(INSTRUMENTS);
	let done = 0;
	const out: Samples = {};
	await Promise.all(
		names.map(async (n) => {
			const r = await fetch(`/samples/${n}.json`);
			out[n] = await r.json();
			onProgress?.(++done, names.length);
		})
	);
	return out;
}
