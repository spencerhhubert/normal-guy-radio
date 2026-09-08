// A station's timeline is a function of its frequency and the clock, so every listener computes the same bar
// at the same moment and tuning in lands mid-cue.
import { hash32 } from './rng.js';
import { stationProfile } from './style.js';
import { createRadio } from './arrange.js';

export const EPOCH = 1788825600; // 2026-09-08T00:00:00Z
export const SEGMENT = 1200; // seconds; each segment of a station is an independent seed

// A station: a frequency id (875..1080) whose timeline since EPOCH is a chain of SEGMENT-long radios.
export function createStation(id) {
  const profile = stationProfile(id);
  let seg = -1, radio = null, elapsed = 0;
  const open = k => { seg = k; radio = createRadio(hash32(id, k, 0x9e3779b9), SEGMENT, profile); elapsed = 0; };
  const take = () => { let bar = radio.nextBar(); if (!bar) { open(seg + 1); bar = radio.nextBar(); } const start = seg * SEGMENT + elapsed; elapsed += bar.dur; return { bar, start }; };
  return {
    id, profile,
    tune(t) { open(Math.floor(t / SEGMENT)); let x; do { x = take(); } while (x.start + x.bar.dur <= t); return x; },
    next: take,
  };
}

const SLOGANS = ['The Normal Guy', 'Soft Hits for Dads', 'All Montage, All Day', 'Your Life Is About to Get Complicated', 'Easy Listening for Hard Times', 'The Sound of a Quirky Neighbor', 'Coming to a Theater Near You', 'Wacky Family FM', 'Meet the In-Laws Radio', 'Build Mode', 'The Toast in His Mouth Hour', 'Lessons Will Be Learned', 'Suburban Smooth', 'Whistle While You Work', 'Two Turntables and a Whistle', 'Now With More Bassoon'];
export function stationName(id) {
  const h = hash32(id, 0xabcdef);
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const call = (h & 1 ? 'K' : 'W') + L[(h >>> 4) % 26] + L[(h >>> 9) % 26] + L[(h >>> 14) % 26];
  return { call, freq: (id / 10).toFixed(1), slogan: SLOGANS[(h >>> 19) % SLOGANS.length] };
}
