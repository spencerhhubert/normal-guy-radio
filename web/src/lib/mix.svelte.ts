import { STEMS } from './audio/engine.js';

type Fader = { level: number; mute: boolean };
type Levels = { setLevel: (name: string, v: number) => void };

// faders for the station being listened to; every station has its own set
export const mix = $state<Record<string, Fader>>({});
export const activity = $state<Record<string, number>>({});
export const COLORS: Record<string, string> = {
	whistle: '#ffd166', bass: '#4cc9f0', drums: '#f4f4f4', shaker: '#b5ead7', triangle: '#f9f871', guitar: '#ff9f1c',
	wurly: '#ff6b6b', organ: '#c77dff', horns: '#ffb703', strings: '#90e0ef', choir: '#e0aaff', harp: '#80ed99',
	clarinet: '#a3f7bf', bassoon: '#d4a373', tuba: '#bc6c25', 'pizz strings': '#9ef01a', glock: '#f1faee', 'muted trumpet': '#fb8500', reverb: '#6c757d'
};
let engine: Levels | null = null, station = 0;

const clamp = (x: number) => (isNaN(x) ? 1 : Math.min(1.5, Math.max(0, x)));
function read(id: number): Record<string, Fader> { try { return JSON.parse(localStorage.getItem(`ngr.mix.${id}`) || '{}'); } catch { return {}; } }
function save() { try { const p = param(); if (p) localStorage.setItem(`ngr.mix.${station}`, JSON.stringify(mix)); else localStorage.removeItem(`ngr.mix.${station}`); } catch { /* private mode */ } }
function replace(next: Record<string, Fader>) { for (const k of Object.keys(mix)) delete mix[k]; Object.assign(mix, next); }
function applyAll() { for (const [n] of STEMS) apply(n); }
function apply(name: string) {
	const f = fader(name);
	for (const strip of STEMS.find(([n]) => n === name)![1]) engine?.setLevel(strip, f.mute ? 0 : f.level);
}
export function parse(s: string): Record<string, Fader> {
	const out: Record<string, Fader> = {};
	for (const part of s.split(',')) {
		const [n, v] = part.split(':'), name = (n || '').replace(/-/g, ' ');
		if (!STEMS.some(([x]) => x === name) || v == null) continue;
		out[name] = v === 'm' ? { level: 1, mute: true } : { level: clamp(parseFloat(v)), mute: false };
	}
	return out;
}
// the non-default faders, for the url
export function param(): string {
	return Object.entries(mix).filter(([, f]) => f.mute || f.level !== 1).map(([n, f]) => `${n.replace(/ /g, '-')}:${f.mute ? 'm' : f.level}`).join(',');
}
export function fader(name: string): Fader { return mix[name] ?? { level: 1, mute: false }; }
export function attach(e: Levels) { engine = e; applyAll(); }
export function useStation(id: number, fromUrl?: string | null) {
	station = id;
	const shared = fromUrl ? parse(fromUrl) : null;
	replace(shared && Object.keys(shared).length ? shared : read(id));
	if (shared) save();
	applyAll();
}
export function set(name: string, patch: Partial<Fader>) { mix[name] = { ...fader(name), ...patch }; apply(name); save(); }
export function reset() { replace({}); applyAll(); save(); }
