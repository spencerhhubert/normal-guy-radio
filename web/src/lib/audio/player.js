// Live playback: bars are scheduled a little ahead of the station clock, so tuning in lands mid-bar.

export class Player {
  /** @param {Engine} engine @param {(bar: any) => void} [onBar] */
  constructor(engine, onBar) { this.engine = engine; this.onBar = onBar; this.timer = null; this.pending = new Set(); }
  // clock(): station time in seconds (since EPOCH), corrected to the server
  /** @param {{ tune: (t: number) => any, next: () => any }} station @param {() => number} clock */
  start(station, clock) {
    const ctx = this.engine.ctx, now = clock();
    const { bar, start } = station.tune(now);
    this.station = station; this.clock = clock;
    this.ctxAtStation = ctx.currentTime + 0.12 - now; // ctx time = station time + offset
    this.queued = { bar, start };
    this.notBefore = ctx.currentTime + 0.1;
    const g = this.engine.master.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0.0001, ctx.currentTime); g.linearRampToValueAtTime(0.9, ctx.currentTime + 0.4);
    this.tick(); this.timer = setInterval(() => this.tick(), 90);
  }
  tick() {
    const ctx = this.engine.ctx;
    while (this.queued.start + this.ctxAtStation < ctx.currentTime + 0.7) {
      const { bar, start } = this.queued, at = start + this.ctxAtStation;
      this.engine.scheduleBar(bar, at, this.notBefore);
      const id = setTimeout(() => { this.pending.delete(id); this.onBar?.(bar); }, Math.max(0, (at - ctx.currentTime) * 1000));
      this.pending.add(id);
      this.queued = this.station.next();
    }
  }
  stop() {
    clearInterval(this.timer); this.timer = null;
    for (const id of this.pending) clearTimeout(id); this.pending.clear();
    const ctx = this.engine.ctx, g = this.engine.master.gain;
    g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    setTimeout(() => this.engine.panic(), 250);
  }
}
