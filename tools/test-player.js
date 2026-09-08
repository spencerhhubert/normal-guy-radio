// node tools/test-player.js — drives the live Player against a fake clock and a fake engine, no audio.
// Checks the lookahead scheduler keeps 0.7 s of music queued, bars are contiguous, and skip re-seeds cleanly.
const fs = require('fs'), vm = require('vm');
const C = require('../composer.js');
const ctx = { Composer: C, setInterval, clearInterval, setTimeout, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../engine.js', 'utf8'), ctx);
const { Player } = ctx.Engine;
let now = 0;
const fakeGainParam = { value: 0.9, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} };
const scheduled = [];
const engine = { ctx: { get currentTime() { return now; } }, master: { gain: fakeGainParam }, scheduleBar(bar, t) { scheduled.push({ t, bar }); }, panic() { scheduled.length = 0; } };
const radio = C.createRadio(42);
const bars = [];
const player = new Player(engine, radio, b => bars.push(b));
player.start();
let problems = 0;
for (let step = 0; step < 300; step++) { now += 0.1; player.tick(); const ahead = player.nextTime - now; if (ahead < 0) { problems++; console.log('fell behind at', now.toFixed(1)); } if (ahead > 4) { problems++; console.log('over-scheduled at', now.toFixed(1), ahead); } }
for (let i = 1; i < scheduled.length; i++) { const a = scheduled[i - 1], b = scheduled[i]; const expect = a.t + 4 * 60 / a.bar.tempo; if (Math.abs(b.t - expect) > 1e-6) { problems++; console.log('gap between bars', a.t, b.t, expect); } }
const before = scheduled.length; player.skip(); const bar = radio.nextBar();
if (bar.section.name !== 'intro' || bar.section.index !== 0) { problems++; console.log('skip did not restart at a new cue intro', bar.section); }
player.stop();
console.log(`scheduled ${before} bars over ${now.toFixed(0)} s of fake time, ${scheduled.length && scheduled[scheduled.length - 1].t.toFixed(1)}s last bar start, problems ${problems}`);
process.exit(problems ? 1 : 0);
