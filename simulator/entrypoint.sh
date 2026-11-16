#!/bin/sh
# The simulator only accepts keys listed in config/api_keys.json (a JSON list of strings).
# We write ours from the environment so no key is baked into the image or the repo.
set -eu
: "${SIMULATOR_API_KEY:?set SIMULATOR_API_KEY (letters and digits only)}"
case "$SIMULATOR_API_KEY" in
  *[!A-Za-z0-9]*) echo "SIMULATOR_API_KEY must be letters and digits only" >&2; exit 1 ;;
esac
printf '["%s"]' "$SIMULATOR_API_KEY" > config/api_keys.json
# Extra arguments (e.g. --desks 10 --no-user-simulation) are passed through.
exec python simulator/main.py --port 8000 "$@"
