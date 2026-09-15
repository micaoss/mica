#!/usr/bin/env bash
# Starts the dev server and puts it behind a named .localhost URL.
#
# astro dev in Astro 7 daemonises itself, so it cannot be wrapped in `nsl run`
# (which expects to supervise a foreground process). Instead the server is
# started on a fixed port and registered with the proxy afterwards.
#
#   astro dev logs --follow   tail the server
#   astro dev status          is it up?
#   astro dev stop            shut it down
set -euo pipefail

name="${NSL_NAME:-mica}"
port="${PORT:-4321}"

bun run docs:prepare
astro dev --port "$port"
bunx nsl route "$name" "$port" --force

echo
echo "  $(bunx nsl get "$name")"
