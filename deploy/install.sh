#!/usr/bin/env bash
# First-time install on a Debian/Ubuntu host. Run as root from this directory. Needs curl and python3.
set -euo pipefail
DIR=/srv/radio
id -u radio >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin radio
mkdir -p "$DIR/data"
chown -R radio:radio "$DIR/data"
install -m 755 update.sh "$DIR/update.sh"
install -m 644 radiod.service radio-update.service radio-update.timer /etc/systemd/system/
systemctl daemon-reload
"$DIR/update.sh"
systemctl enable --now radiod radio-update.timer
