#!/usr/bin/env bash
# web/tools/og.sh — screenshot the /og route into static/og.png. Needs the web dev server up and Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 \
  --virtual-time-budget=4000 --screenshot="$PWD/static/og.png" "http://localhost:5179/og" 2>/dev/null
echo static/og.png
