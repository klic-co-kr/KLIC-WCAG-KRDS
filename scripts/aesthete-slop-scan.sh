#!/usr/bin/env bash
# Run KLIC-Aesthete slop scanner against live pages (or offline HTML dumps).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AESTHETE="${AESTHETE_DIR:-$HOME/src/KLIC-Aesthete}"
BASE="${SLOP_BASE_URL:-http://127.0.0.1:3000}"
OUT="${SLOP_OUT_DIR:-/tmp/klic-aesthete-slop}"
mkdir -p "$OUT"

if [[ ! -f "$AESTHETE/lib/slop.mjs" ]]; then
  echo "KLIC-Aesthete not found at $AESTHETE" >&2
  echo "git clone https://github.com/klic-co-kr/KLIC-Aesthete.git $AESTHETE" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun required for Aesthete slop.mjs" >&2
  exit 1
fi

pages=(/ /login /dashboard /rules)
fail=0
for p in "${pages[@]}"; do
  name=$(echo "$p" | tr '/' '_' | sed 's/^_//')
  [[ -z "$name" ]] && name=home
  html="$OUT/${name}.html"
  json="$OUT/${name}.slop.json"
  code=$(curl -sS -o "$html" -w '%{http_code}' --max-time 10 "${BASE}${p}" || echo 000)
  if [[ "$code" != "200" ]]; then
    echo "FAIL fetch ${p} http=$code"
    fail=1
    continue
  fi
  type=marketing
  [[ "$p" == "/dashboard" || "$p" == "/rules" ]] && type=dashboard
  bun "$AESTHETE/lib/slop.mjs" "$html" "$json" --type "$type" | tee "$OUT/${name}.log"
  count=$(python3 -c "import json;print(json.load(open('$json'))['summary']['slopCount'])")
  if [[ "$count" != "0" ]]; then
    echo "FAIL slop count=$count on $p"
    fail=1
  else
    echo "OK $p slop=0"
  fi
done

# HTML report template sample (static style scan)
if [[ -f "$ROOT/src/lib/krds/export/html-report.ts" ]]; then
  python3 - <<'PY' "$ROOT" "$OUT"
from pathlib import Path
import re, sys
root=Path(sys.argv[1]); out=Path(sys.argv[2])
t=(root/"src/lib/krds/export/html-report.ts").read_text()
# crude extract CSS+minimal shell
m=re.search(r"`<!DOCTYPE html>[\s\S]*$", t)
html = m.group(0)[1:-1] if m else t
# replace template bits
html=re.sub(r"\$\{[^}]+\}", "X", html)
(out/"report-template.html").write_text(html)
print("wrote report-template.html", len(html))
PY
  bun "$AESTHETE/lib/slop.mjs" "$OUT/report-template.html" "$OUT/report-template.slop.json" --type report | tee "$OUT/report-template.log" || true
fi

echo "OUT=$OUT"
exit $fail
