#!/bin/bash
set -e

TYPE="${1:-patch}"
CURRENT=$(cat version.txt | tr -d '[:space:]')

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: ./bump.sh [major|minor|patch]"; exit 1 ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"
echo "$NEW" > version.txt

if [[ "$OSTYPE" == "darwin"* ]]; then
  SED="sed -i '' -E"
else
  SED="sed -i -E"
fi

find . -name "*.html" -not -path "./node_modules/*" -not -path "./cvs/node_modules/*" | while read -r file; do
  eval "$SED 's/\\?v=[0-9]+\\.[0-9]+\\.[0-9]+/?v=$NEW/g' \"$file\""
done

find . -name "sm-loader.js" | while read -r file; do
  eval "$SED \"s/var V = '[0-9]+\\.[0-9]+\\.[0-9]+'/var V = '$NEW'/\" \"$file\""
done

find . -name "sm-core.js" | while read -r file; do
  eval "$SED \"s/const VERSION = '[0-9]+\\.[0-9]+\\.[0-9]+'/const VERSION = '$NEW'/\" \"$file\""
done

echo "Bumped $CURRENT → $NEW ($TYPE)"
