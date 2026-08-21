#!/usr/bin/env bash
# Prefer project-root next start so playwright resolves correctly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

lsof -ti:3000 | xargs kill -9 2>/dev/null || true

if [[ ! -f .next/BUILD_ID ]]; then
  npm run build
fi

export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"

echo "Starting next start on 0.0.0.0:3000 (playwright-friendly)"
exec npx next start -p 3000 -H 0.0.0.0
