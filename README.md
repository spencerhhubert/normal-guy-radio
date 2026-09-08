# Normal Guy Radio

An endless, always-changing stream of 2000s family-comedy film-score music. Funk rhythm section
(finger bass, muted guitar, drums, shaker, triangle, wurly, rock organ with slides) under a whistled
tune, with french horns, strings, harp glissandi, choir, and clarinet/bassoon/tuba for the goofy bits.

Open `index.html` in a browser and press play. Nothing is streamed; everything is composed and played
in the page. Space toggles play, "skip" jumps to the next cue, and the seed box makes a run
reproducible (the same seed always plays the same music).

## How it works

- `composer.js` writes the music one bar at a time, forever. It builds "cues" (60 to 110 seconds each)
  with their own key, tempo (94 to 108 bpm), chord progression, melody instrument, groove patterns,
  intro style and section plan (intro, groove, A, build, B, breakdown, climax, outro), then hands off
  to the next cue with a stop-and-harp-gliss, a drum fill, or an organ slide. Melodies are phrase-based
  (A A' B A'') with chord tones on strong beats, mostly stepwise motion, scoops and grace notes.
- `engine.js` plays the events with the Web Audio API: sampled General MIDI instruments (looped at
  their steady state for long notes, crossfaded so the loop is inaudible), synthesized
  kick/snare/hats/shaker/triangle/crash, a convolution reverb with a generated impulse, and a glue
  compressor with a soft clipper on the master.
- `samples/` is a trimmed subset of the MusyngKite soundfont renders from
  [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MIT): one mp3 per
  semitone in each instrument's useful register (every other semitone for pads and chord
  instruments), wrapped in JS so the page works from `file://`. `tools/trim-samples.py` rebuilds them.

## Dev loop

The reference clip was characterized with librosa (tempo, key, band energies, spectral centroid,
onset density, harmonic-to-percussive energy ratio, loudness curve). A render is compared against those
numbers, and a spectrogram is drawn next to the reference. Renders are offline, so nothing plays.

    python tools/harness.py                        # serves the repo on :5179 and accepts rendered wavs
    open "http://127.0.0.1:5179/?render=90&seed=3" # renders offline, posts renders/seed3-90s.wav
    python tools/analyze.py renders/seed3-90s.wav  # feature comparison against the reference numbers
    python tools/spectro.py out.png renders/ref.wav renders/seed3-90s.wav
    node tools/test-composer.js 3 400              # structural checks on the composer alone
    node tools/test-player.js                      # the live lookahead scheduler against a fake clock
