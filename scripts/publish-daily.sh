#!/usr/bin/env bash
# Bootstrap the daily dashboard publisher.
#
# The publisher must run outside the Desktop: macOS TCC denies background jobs
# (launchd, cron) access to ~/Desktop/NFL_Main, so a publish step that reads the
# user's checkout fails with "Operation not permitted". This wrapper keeps an
# isolated clone under Application Support and hands off to the versioned
# publisher inside it — the clone is always on the same commit as origin/main,
# so the logic that runs is the logic that shipped.
#
# Invoked by fantasyfootball/scripts/daily-pipeline.sh (PUBLISH_DASHBOARD=1),
# or by hand:
#   bash scripts/publish-daily.sh --dry-run
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PUBLISH_ROOT="${PUBLISH_ROOT:-$HOME/Library/Application Support/nfldashboard-publish}"
CHECKOUT="${PUBLISH_CHECKOUT:-$PUBLISH_ROOT/nfldashboard}"
REMOTE="${PUBLISH_REMOTE:-https://github.com/shyam4902/nfldashboard.git}"
RUNTIME="${NFL_PROPS_RUNTIME_ROOT:-$HOME/Library/Application Support/nfldashboard-props}"

NODE="${NODE:-/Users/shyampatel/.local/bin/node}"
if [ ! -x "$NODE" ]; then
  NODE="$(command -v node || true)"
fi
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "publish-daily: no executable Node.js runtime found; set NODE=/absolute/path/to/node" >&2
  exit 1
fi

if [ ! -d "$CHECKOUT/.git" ]; then
  echo "publish-daily: cloning $REMOTE into $CHECKOUT"
  mkdir -p "$PUBLISH_ROOT"
  git clone --origin origin "$REMOTE" "$CHECKOUT"
fi

# Prefer the publisher inside the isolated checkout (always at origin/main),
# but fall back to the copy installed beside this wrapper so the very first run
# works before that commit has reached origin.
PUBLISHER="$CHECKOUT/scripts/publish-daily.js"
[ -f "$PUBLISHER" ] || PUBLISHER="$SCRIPT_DIR/publish-daily.js"

if [ ! -f "$PUBLISHER" ]; then
  echo "publish-daily: no publisher script found (looked in $CHECKOUT/scripts and $SCRIPT_DIR)" >&2
  exit 1
fi

exec "$NODE" "$PUBLISHER" \
  --root "$CHECKOUT" --runtime "$RUNTIME" --node "$NODE" "$@"
