// Deterministic randomness: every listener derives the same numbers from the same seeds.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash32(...xs) {
  let h = 0x811c9dc5;
  for (const x of xs) { h ^= x >>> 0; h = Math.imul(h, 0x01000193); h ^= h >>> 15; }
  return h >>> 0;
}
export class Rng {
  constructor(seed) { this.r = mulberry32(seed); }
  f() { return this.r(); }
  i(n) { return Math.floor(this.r() * n); }
  range(a, b) { return a + this.r() * (b - a); }
  int(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  weighted(pairs) {
    let s = 0; for (const p of pairs) s += p[1];
    let x = this.r() * s;
    for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }
}
