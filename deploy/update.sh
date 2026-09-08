#!/usr/bin/env bash
# Installs the latest GitHub release if it is newer than what is running. Run by radio-update.timer.
set -euo pipefail
REPO=${REPO:-spencerhhubert/normal-guy-radio}
DIR=${DIR:-/srv/radio}

latest=$(curl -fsSL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$REPO/releases/latest" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])')
[ -n "$latest" ] || exit 0
[ "$latest" != "$(cat "$DIR/VERSION" 2>/dev/null || true)" ] || exit 0

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
base="https://github.com/$REPO/releases/download/$latest"
for f in radiod-linux-amd64 web.tar.gz SHA256SUMS; do curl -fsSL -o "$tmp/$f" "$base/$f"; done
(cd "$tmp" && sha256sum -c --quiet SHA256SUMS)

install -m 755 "$tmp/radiod-linux-amd64" "$DIR/radiod.new"
rm -rf "$DIR/web.new" && mkdir -p "$DIR/web.new" && tar -xzf "$tmp/web.tar.gz" -C "$DIR/web.new"
mv -f "$DIR/radiod.new" "$DIR/radiod"
rm -rf "$DIR/web.old"
[ ! -d "$DIR/web" ] || mv "$DIR/web" "$DIR/web.old"
mv "$DIR/web.new" "$DIR/web"
echo "$latest" > "$DIR/VERSION"
systemctl restart radiod
echo "radio: $latest"
