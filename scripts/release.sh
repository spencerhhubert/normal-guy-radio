#!/usr/bin/env bash
# scripts/release.sh 0.2.0 — tags and pushes; the release workflow builds and publishes, boxes pull it.
set -euo pipefail
v="v${1:?version}"
git diff --quiet && git diff --cached --quiet || { echo "commit first"; exit 1; }
git tag -a "$v" -m "$v"
git push origin main "$v"
