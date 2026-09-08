# Normal Radio

An FM band of stations that all play 2000s family-comedy film score, composed live in the browser
and never repeating. Funk rhythm section, whistle, french horns, strings, harp glissandi, choir, and
clarinet, bassoon and tuba for the goofy bits.

Every station's music is a pure function of its frequency and the clock. Tuning in computes what the
station is playing right now and joins mid-cue, so everyone on a station hears the same thing at the
same moment, and nothing has to run while nobody is listening. A small server keeps track of who is
tuned where so occupied stations light up on the dial.

## Layout

- `web/` SvelteKit site. `src/lib/composer.js` writes the music one bar at a time; `src/lib/engine.js`
  plays it with the Web Audio API (sampled instruments, synthesized percussion, reverb, glue
  compression). `static/samples/` is a trimmed subset of the MusyngKite renders from
  [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MIT).
- `server/` Go service: listener presence, server clock, and the built site. Generated from
  `api/openapi.yaml` with oapi-codegen; the site's client types come from the same spec.
- `deploy/` systemd units and an updater that installs the latest GitHub release.
- `tools/` the analysis loop that compared renders against the reference clip while the style was
  being tuned.

## Develop

    cd server && go run . -dev -web ../web/build   # API on :8811, serves web/build, accepts /dev/render
    cd web && npm install && npm run dev            # site on :5179, proxies /api to :8811

On localhost the site is silent by design: the meters, scope and display run but nothing reaches the
speakers. Add `?sound=1` to hear it, or `?mute=1` to silence it anywhere.
    cd web && npm test                              # composer checks
    cd server && go test ./...

Changing `api/openapi.yaml`: `cd server && go generate ./...` and `cd web && npm run api`.

## Release

    scripts/release.sh            # bumps the patch version from the latest tag; or `minor`, `major`

The tag triggers the release workflow, which builds the site and the Linux binary and publishes them
as release assets. A host installed with `deploy/install.sh` checks for a new release every three
minutes and swaps itself over.

## Sharing

Links preview with `web/static/og.png`, a screenshot of the `/og` route. The server fills in the
host and, for a `?fm=` link, the station's frequency in the title. Regenerate the image with
`web/tools/og.sh` while the dev servers are up.
