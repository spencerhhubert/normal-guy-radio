#!/usr/bin/env bash
# scripts/release.sh [patch|minor|major] — bumps the latest v* tag, tags and pushes; the release workflow builds and publishes, boxes pull it.
set -euo pipefail
git diff --quiet && git diff --cached --quiet || { echo "commit first"; exit 1; }
git fetch --tags -q
last=$(git tag --list 'v*' --sort=-v:refname | head -1)
IFS=. read -r major minor patch <<< "${last#v}"
case "${1:-patch}" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
  *) echo "usage: $0 [patch|minor|major]"; exit 1 ;;
esac
v="v$major.$minor.$patch"
git tag -a "$v" -m "$v"
git push origin main "$v"
echo "$v"
