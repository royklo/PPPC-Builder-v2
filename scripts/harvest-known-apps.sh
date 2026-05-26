#!/usr/bin/env bash
# Harvest designated code requirements from installed macOS apps and emit
# JSON entries in the shape used by public/library/known-apps.json.
#
# Usage:
#   ./scripts/harvest-known-apps.sh                # scans /Applications
#   ./scripts/harvest-known-apps.sh /path/to/Apps  # scan a different dir
#
# Diff against the existing list:
#   ./scripts/harvest-known-apps.sh | jq -s '.[].bundleId' | sort -u > /tmp/found.txt
#   jq -r '.apps[].bundleId' public/library/known-apps.json | sort -u > /tmp/known.txt
#   comm -23 /tmp/found.txt /tmp/known.txt   # apps on disk not yet in JSON

set -uo pipefail

SCAN_DIR="${1:-/Applications}"

if [[ ! -d "$SCAN_DIR" ]]; then
  echo "Directory not found: $SCAN_DIR" >&2
  exit 1
fi

# shell-escape a string into a JSON-safe value (handles backslashes and quotes)
json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip("\n")))'
}

shopt -s nullglob
for app in "$SCAN_DIR"/*.app; do
  plist="$app/Contents/Info.plist"
  [[ -f "$plist" ]] || continue

  bundle_id=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$plist" 2>/dev/null || true)
  [[ -n "$bundle_id" ]] || continue

  display_name=$(/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "$plist" 2>/dev/null \
              || /usr/libexec/PlistBuddy -c "Print :CFBundleName" "$plist" 2>/dev/null \
              || basename "$app" .app)

  dr=$(codesign --display -r - "$app" 2>&1 | awk -F'=> ' '/^designated/ {print $2}')
  [[ -n "$dr" ]] || continue

  jb=$(printf '%s' "$bundle_id"    | json_escape)
  jn=$(printf '%s' "$display_name" | json_escape)
  jr=$(printf '%s' "$dr"           | json_escape)

  printf '{ "bundleId": %s, "displayName": %s, "codeRequirement": %s }\n' "$jb" "$jn" "$jr"
done
