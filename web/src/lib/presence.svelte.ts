import { api } from './api';

export type Person = { name: string; emoji: string };
export type Station = { id: number; listeners: number; lastHeard: number; people: Person[] };

// a listener is this tab; a person is this browser, and their name follows them back tomorrow
const keep = (store: Storage, k: string) => { try { let v = store.getItem(k); if (!v) { v = crypto.randomUUID(); store.setItem(k, v); } return v; } catch { return crypto.randomUUID(); } };
const listener = keep(sessionStorage, 'ngr.listener'), person = keep(localStorage, 'ngr.person');

export const presence = $state({ stations: [] as Station[], me: null as Person | null });

export const station = (id: number) => presence.stations.find((s) => s.id === id);
const has = (s: Station) => !!presence.me && s.people.some((p) => p.name === presence.me!.name);
const without = (s: Station) => (has(s) ? { ...s, listeners: Math.max(0, s.listeners - 1), people: s.people.filter((p) => p.name !== presence.me!.name) } : s);
const withMe = (s: Station) => (presence.me && !has(s) ? { ...s, listeners: s.listeners + 1, people: [...s.people, presence.me] } : s);

export async function refresh() {
	const { data } = await api.GET('/stations');
	if (data) presence.stations = data.stations;
}
export async function beat(id: number) {
	const { data } = await api.POST('/listen', { body: { station: id, listener, person } });
	if (!data) return;
	presence.me = data.you;
	presence.stations = station(id) ? presence.stations.map((s) => (s.id === id ? data.station : s)) : [data.station, ...presence.stations];
	refresh();
}
export function leave(id: number) {
	try { navigator.sendBeacon('/api/leave', new Blob([JSON.stringify({ listener })], { type: 'application/json' })); } catch { /* the page is going away anyway */ }
	presence.stations = presence.stations.map((s) => (s.id === id ? without(s) : s));
}
// what the list should show before the server confirms a move
export function move(from: number, to: number) {
	presence.stations = presence.stations.map((s) => (s.id === from ? without(s) : s.id === to ? withMe(s) : s));
	if (presence.me && !station(to)) presence.stations = [...presence.stations, { id: to, listeners: 1, lastHeard: Math.floor(Date.now() / 1000), people: [presence.me] }];
}
