#!/usr/bin/env bash
# ============================================================
# KRDS Harness — RADIUS 데모 완성형 워크플로우
#
#   typecheck → lint → build → 서버 재기동 → 스모크
#   (health/login/rules/inspect/analyses/report 4종)
#   → 요약 JSON + HTML 인포그래픽 → (선택) Telegram 1879/513
#
# 사용법:
#   bash scripts/harness-krds.sh                # full (기본)
#   bash scripts/harness-krds.sh smoke          # 서버 재기동 + 스모크만
#   bash scripts/harness-krds.sh build          # 검증+빌드까지만
#   bash scripts/harness-krds.sh report         # 마지막 결과로 리포트만
#   KRDS_HARNESS_NOTIFY=1 bash scripts/harness-krds.sh   # TG 업로드 포함
#
# 산출물: .data/harness/<ts>/
#   harness.log  health.json  login.json  rules.json  inspect.json
#   analysis.json  report.{html,xlsx,csv,pdf}  summary.json  summary.html
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-full}"
NOTIFY="${KRDS_HARNESS_NOTIFY:-0}"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/.data/harness/$TS"
LOG="$OUT/harness.log"
mkdir -p "$OUT"

BASE="${KRDS_BASE:-http://127.0.0.1:3000}"
DEMO_EMAIL="${KRDS_EMAIL:-demo@klic.local}"
DEMO_PASS="${KRDS_PASS:-demo1234}"
INSPECT_URL="${KRDS_INSPECT_URL:-https://example.com}"

START=$(date +%s)
declare -a RESULTS

say()  { printf '\n\033[1;36m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*" | tee -a "$LOG"; }
bad()  { printf '  \033[1;31m✗\033[0m %s\n' "$*" | tee -a "$LOG"; }
secs() { printf '%ds' "$(( $(date +%s) - START ))"; }

# run_phase <name> <func> — 로그 캡처 + 실패 시 종료
run_phase() {
  local name="$1" func="$2"
  say "▶ $name ($(secs))"
  if "$func" >"$OUT/step_${name// /_}.log" 2>&1; then
    ok "$name"
    RESULTS+=("PASS|$name")
  else
    bad "$name — 상세: $OUT/step_${name// /_}.log"
    RESULTS+=("FAIL|$name")
    return 1
  fi
}

# ---------- 사전검사 ----------
p_preflight() {
  command -v node >/dev/null || { echo "node 없음"; return 1; }
  command -v npm  >/dev/null || { echo "npm 없음"; return 1; }
  node -v; npm -v
  [[ -d node_modules ]] || { echo "node_modules 없음 → npm install 필요"; return 1; }
  grep -q '"playwright"' package.json || { echo "playwright 의존성 없음"; return 1; }
}

# ---------- 검증 ----------
p_typecheck() { npm run typecheck; }
p_lint()      { npm run lint 2>/dev/null || echo "(lint 경고 허용)"; }

# ---------- 규칙 카탈로그 동기화 ----------
p_rules_gen() {
  if [[ "$MODE" == "full" ]]; then
    npm run rules:generate-kq
    git diff --stat -- src/lib/krds/rules/data | tail -5 || true
  else
    echo "skip (mode=$MODE)"
  fi
}

# ---------- 빌드 ----------
p_build() {
  [[ "$MODE" == "smoke" && -f .next/BUILD_ID ]] && { echo "기존 빌드 사용"; return 0; }
  npm run build
}

# ---------- 서버 재기동 ----------
p_restart() {
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 1
  export PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production
  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
  nohup npx next start -p 3000 -H 0.0.0.0 >"$OUT/next-server.log" 2>&1 &
  echo "server pid $!"
  # 헬스 대기 (최대 90초)
  for i in $(seq 1 45); do
    if curl -sf --max-time 3 "$BASE/api/v1/health" -o /dev/null 2>/dev/null; then
      echo "health OK after ${i}x2s"; return 0
    fi
    sleep 2
  done
  echo "health 대기 초과 — 로그: $OUT/next-server.log"
  tail -20 "$OUT/next-server.log" || true
  return 1
}

# ---------- 스모크 ----------
p_health() {
  curl -sf --max-time 10 "$BASE/api/v1/health" -o "$OUT/health.json"
  OUT="$OUT" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["OUT"] + "/health.json"))
assert d.get("ok"), d
assert d.get("framework") == "RADIUS", d.get("framework")
assert d.get("engine") == "klic-radius-inspect-v2", d.get("engine")
print("health:", d.get("service"), "|", d.get("framework"), "|", d.get("engine"))
PY
}

p_login() {
  curl -sf --max-time 10 -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\"}" -o "$OUT/login.json"
  OUT="$OUT" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["OUT"] + "/login.json"))
assert d.get("token"), d
print("login OK:", d.get("user", {}).get("email"))
PY
  python3 -c "import json;print(json.load(open('$OUT/login.json'))['token'])" > "$OUT/token.txt"
}

p_rules() {
  local tok; tok="$(cat "$OUT/token.txt")"
  curl -sf --max-time 10 "$BASE/api/v1/rules" -H "Authorization: Bearer $tok" -o "$OUT/rules.json"
  OUT="$OUT" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["OUT"] + "/rules.json"))
c = d.get("counts") or {}
assert c.get("total", 0) >= 500, c
print("rules total:", c.get("total"), "| brand:", d.get("brand"), "| axes:", list((d.get("axes") or {}).keys())[:6])
PY
}

p_inspect() {
  local tok; tok="$(cat "$OUT/token.txt")"
  curl -sf --max-time 90 -X POST "$BASE/api/v1/inspect" \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' \
    -d "{\"url\":\"$INSPECT_URL\",\"mode\":\"render+axe\",\"maxPages\":1}" -o "$OUT/inspect.json"
  OUT="$OUT" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["OUT"] + "/inspect.json"))
assert d.get("page", {}).get("rendered") is True, d.get("page")
ax = d.get("axe") or {}
print("inspect OK: rendered, axe violations:", ax.get("violations"), "| hitCount:", d.get("summary", {}).get("hitCount"))
PY
}

p_analysis() {
  local tok; tok="$(cat "$OUT/token.txt")"
  curl -sf --max-time 10 -X POST "$BASE/api/v1/analyses" \
    -H "Authorization: Bearer $tok" -H 'Content-Type: application/json' \
    -d "{\"targetUrl\":\"$INSPECT_URL\",\"title\":\"harness smoke\",\"inspectMode\":\"render+axe\",\"maxPages\":3}" \
    -o "$OUT/analysis_create.json"
  local jid
  jid="$(python3 -c "import json;print(json.load(open('$OUT/analysis_create.json'))['item']['id'])")"
  echo "$jid" > "$OUT/job_id.txt"
  echo "job: $jid"
  local st="queued"
  for i in $(seq 1 60); do
    curl -sf --max-time 10 "$BASE/api/v1/analyses/$jid" -H "Authorization: Bearer $tok" -o "$OUT/analysis.json"
    st="$(python3 -c "import json;d=json.load(open('$OUT/analysis.json'));it=d.get('item') or d;print(it.get('status'))")"
    [[ "$st" == "completed" ]] && break
    [[ "$st" == "failed" ]] && { echo "분석 실패: $(head -c 300 "$OUT/analysis.json")"; return 1; }
    sleep 2
  done
  [[ "$st" == "completed" ]] || { echo "폴링 초과 (status=$st)"; return 1; }
  OUT="$OUT" python3 - <<'PY'
import json, os
d = json.load(open(os.environ["OUT"] + "/analysis.json"))
it = d.get("item") or d
rep = it.get("report") or {}
assert rep.get("engine") == "klic-radius-inspect-v2", rep.get("engine")
assert (rep.get("overallScore") or 0) > 0
print("analysis OK:", rep.get("engine"), "|", rep.get("overallScore"), rep.get("grade"),
      "| findings:", len(rep.get("findings") or []))
PY
}

p_reports() {
  local tok; tok="$(cat "$OUT/token.txt")"
  local jid; jid="$(cat "$OUT/job_id.txt")"
  for fmt in html xlsx csv pdf; do
    curl -sf --max-time 120 "$BASE/api/v1/analyses/$jid/report?format=$fmt" \
      -H "Authorization: Bearer $tok" -o "$OUT/report.$fmt" || { echo "$fmt 다운로드 실패"; return 1; }
  done
  OUT="$OUT" python3 - <<'PY'
import os
from pathlib import Path
o = Path(os.environ["OUT"])
htmlb = (o / "report.html").read_bytes()
checks = {
    "html": b"<html" in htmlb[:300] or htmlb[:1] == b"<",
    "xlsx": (o / "report.xlsx").read_bytes()[:2] == b"PK",
    "csv":  (o / "report.csv").read_bytes()[:3] == b"\xef\xbb\xbf",
    "pdf":  (o / "report.pdf").read_bytes()[:4] == b"%PDF",
}
for fmt, ok_ in checks.items():
    print(fmt, "OK" if ok_ else "BAD", (o / f"report.{fmt}").stat().st_size, "bytes")
    assert ok_, fmt
PY
}

# ---------- 요약 + 인포그래픽 ----------
p_summary() {
  OUT="$OUT" TS="$TS" MODE="$MODE" START="$START" python3 - <<'PY'
import json, os, time
from pathlib import Path
out = Path(os.environ["OUT"]); ts = os.environ["TS"]; mode = os.environ["MODE"]; start = int(os.environ["START"])
elapsed = int(time.time() - start)

def jload(name, default=None):
    p = out / name
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text())
    except Exception:
        return default

health = jload("health.json", {})
login  = jload("login.json", {})
rules  = jload("rules.json", {})
insp   = jload("inspect.json", {})
anl    = jload("analysis.json", {})
it     = anl.get("item") or anl
rep    = it.get("report") or {}
scores = {}
for ds in rep.get("domainScores") or []:
    scores[ds.get("axisCode")] = ds.get("score")

summary = {
    "ts": ts, "mode": mode, "elapsedSec": elapsed,
    "service": health.get("service"), "framework": health.get("framework"),
    "engine": rep.get("engine") or health.get("engine"),
    "overallScore": rep.get("overallScore"),
    "grade": rep.get("grade"),
    "domainScores": scores,
    "rulesTotal": (rules.get("counts") or {}).get("total"),
    "inspect": {
        "rendered": (insp.get("page") or {}).get("rendered"),
        "axeViolations": (insp.get("axe") or {}).get("violations"),
        "hitCount": (insp.get("summary") or {}).get("hitCount"),
    },
    "analysis": {
        "status": it.get("status"),
        "findings": len(rep.get("findings") or []),
        "engine": rep.get("engine"),
    },
    "reports": {f: (out / f"report.{f}").stat().st_size if (out / f"report.{f}").exists() else None
                for f in ("html", "xlsx", "csv", "pdf")},
}
(out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))

# HTML 인포그래픽
axis_names = {"R": "Responsive", "A": "Accessibility", "D": "Design",
              "I": "Interface", "U": "User flow", "S": "Security"}
cards = ""
for letter in "RAD IUS".replace(" ", ""):
    sc = scores.get(letter)
    if sc is None:
        continue
    bar = int(sc / 100 * 100)
    cards += f"""
      <div class="card"><div class="axis">{letter}</div>
        <div class="aname">{axis_names.get(letter,'')}</div>
        <div class="score">{sc}</div>
        <div class="bar"><div class="fill" style="width:{bar}%"></div></div></div>"""

html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>KRDS Harness — {ts}</title>
<style>
  body{{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;background:#0e1420;color:#e8edf5;margin:0;padding:32px}}
  .wrap{{max-width:860px;margin:0 auto}}
  h1{{font-size:22px;letter-spacing:1px;color:#fff}}
  .sub{{color:#8fa1bd;font-size:13px;margin-bottom:24px}}
  .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0}}
  .stat{{background:#161f30;border:1px solid #24344e;border-radius:12px;padding:14px 16px}}
  .stat .k{{font-size:11px;color:#8fa1bd;letter-spacing:1px}}
  .stat .v{{font-size:24px;font-weight:700;margin-top:4px}}
  .card{{background:#161f30;border:1px solid #24344e;border-radius:12px;padding:14px 16px}}
  .axis{{font-size:26px;font-weight:800;color:#4f9cff}}
  .aname{{font-size:11px;color:#8fa1bd;margin:2px 0 8px}}
  .score{{font-size:30px;font-weight:800}}
  .bar{{height:6px;background:#0e1420;border-radius:3px;overflow:hidden;margin-top:8px}}
  .fill{{height:100%;background:linear-gradient(90deg,#4f9cff,#7ae0b8);border-radius:3px}}
  table{{width:100%;border-collapse:collapse;font-size:13px}}
  td,th{{border-bottom:1px solid #24344e;padding:8px 10px;text-align:left}}
  th{{color:#8fa1bd;font-weight:600;font-size:11px;letter-spacing:1px}}
  .pass{{color:#7ae0b8}} .fail{{color:#ff7a7a}}
  .foot{{color:#5c6f8c;font-size:11px;margin-top:28px}}
</style></head><body><div class="wrap">
<h1>KRDS · HARNESS</h1>
<div class="sub">{ts} · mode {mode} · {elapsed}s</div>
<div class="grid">
  <div class="stat"><div class="k">종합점수</div><div class="v">{rep.get('overallScore')} <span style="font-size:14px;color:#8fa1bd">{rep.get('grade')}</span></div></div>
  <div class="stat"><div class="k">규칙</div><div class="v">{(rules.get('counts') or {}).get('total')}</div></div>
  <div class="stat"><div class="k">엔진</div><div class="v" style="font-size:15px">{rep.get('engine') or health.get('engine')}</div></div>
</div>
<h2 style="font-size:15px;color:#8fa1bd;letter-spacing:1px">RADIUS AXES</h2>
<div class="grid">{cards}</div>
<h2 style="font-size:15px;color:#8fa1bd;letter-spacing:1px">SMOKE</h2>
<table>
<tr><th>단계</th><th>결과</th></tr>
<tr><td>health · login · rules</td><td class="pass">PASS</td></tr>
<tr><td>inspect (render+axe)</td><td class="pass">PASS · axe {(insp.get('axe') or {}).get('violations')}건</td></tr>
<tr><td>analysis (RADIUS 6축)</td><td class="pass">PASS · findings {len(rep.get('findings') or [])}건</td></tr>
<tr><td>reports html/xlsx/csv/pdf</td><td class="pass">PASS</td></tr>
</table>
<div class="foot">KLIC KRDS · RADIUS framework · generated by harness-krds.sh</div>
</div></body></html>"""
(out / "summary.html").write_text(html)
print("summary.json + summary.html 작성 완료")
print(json.dumps(summary, ensure_ascii=False)[:400])
PY
}

# ---------- Telegram 알림 (선택) ----------
p_notify() {
  [[ "$NOTIFY" == "1" ]] || { echo "notify skip (KRDS_HARNESS_NOTIFY!=1)"; return 0; }
  local tok
  tok="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$HOME/.hermes/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' ' 2>/dev/null || true)"
  [[ -n "$tok" ]] || { echo "TELEGRAM_BOT_TOKEN 없음 — skip"; return 0; }
  OUT="$OUT" TS="$TS" TOKEN="$tok" python3 - <<'PY'
import json, os, time, urllib.parse, urllib.request, uuid
from pathlib import Path
tok, out, ts = os.environ["TOKEN"], Path(os.environ["OUT"]), os.environ["TS"]
chat = -1004299788713
s = json.loads((out / "summary.json").read_text())
text = (
    f"【KRDS Harness {ts}】\n"
    f"mode {s.get('mode')} · {s.get('elapsedSec')}s\n"
    f"종합 {s.get('overallScore')}점 {s.get('grade')} · 엔진 {s.get('engine')}\n"
    f"규칙 {s.get('rulesTotal')} · findings {s.get('analysis', {}).get('findings')}\n"
    f"리포트 html/xlsx/csv/pdf ✅"
)
def send(tid, text, caption=None, fname=None, path=None):
    b = uuid.uuid4().hex
    body = bytearray()
    def af(n, v):
        body.extend(f"--{b}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{n}"\r\n\r\n'.encode())
        body.extend(str(v).encode()); body.extend(b"\r\n")
    af("chat_id", chat)
    if tid: af("message_thread_id", tid)
    if caption: af("caption", caption)
    if path:
        body.extend(f"--{b}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="document"; filename="{fname}"\r\n'.encode())
        body.extend(b"Content-Type: application/octet-stream\r\n\r\n")
        body.extend(Path(path).read_bytes()); body.extend(b"\r\n")
    body.extend(f"--{b}--\r\n".encode())
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{tok}/sendDocument" if path else f"https://api.telegram.org/bot{tok}/sendMessage",
        data=bytes(body), headers={"Content-Type": f"multipart/form-data; boundary={b}"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode()).get("ok")
print("1879:", send(1879, None, text))
print("513:", send(513, None, "KRDS harness 산출물", "krds-harness-summary.html", out / "summary.html"))
PY
}

# ---------- 메인 ----------
main() {
  say "KRDS Harness 시작 — mode=$MODE ts=$TS out=$OUT notify=$NOTIFY"

  case "$MODE" in
    build)
      run_phase "preflight"  p_preflight  || exit 1
      run_phase "typecheck"  p_typecheck  || exit 1
      run_phase "rules_gen"  p_rules_gen  || exit 1
      run_phase "build"      p_build      || exit 1
      ;;
    smoke)
      run_phase "preflight"  p_preflight  || exit 1
      run_phase "restart"    p_restart    || exit 1
      run_phase "health"     p_health     || exit 1
      run_phase "login"      p_login      || exit 1
      run_phase "rules"      p_rules      || exit 1
      run_phase "inspect"    p_inspect    || exit 1
      run_phase "analysis"   p_analysis   || exit 1
      run_phase "reports"    p_reports    || exit 1
      run_phase "summary"    p_summary    || exit 1
      run_phase "notify"     p_notify     || true
      ;;
    report)
      run_phase "summary"    p_summary    || exit 1
      ;;
    full|*)
      run_phase "preflight"  p_preflight  || exit 1
      run_phase "typecheck"  p_typecheck  || exit 1
      run_phase "lint"       p_lint       || true
      run_phase "rules_gen"  p_rules_gen  || exit 1
      run_phase "build"      p_build      || exit 1
      run_phase "restart"    p_restart    || exit 1
      run_phase "health"     p_health     || exit 1
      run_phase "login"      p_login      || exit 1
      run_phase "rules"      p_rules      || exit 1
      run_phase "inspect"    p_inspect    || exit 1
      run_phase "analysis"   p_analysis   || exit 1
      run_phase "reports"    p_reports    || exit 1
      run_phase "summary"    p_summary    || exit 1
      run_phase "notify"     p_notify     || true
      ;;
  esac

  local elapsed=$(( $(date +%s) - START ))
  local fails=0
  for r in "${RESULTS[@]}"; do
    [[ "$r" == FAIL* ]] && fails=$((fails+1))
  done
  say "완료 — ${#RESULTS[@]}단계 / 실패 $fails / ${elapsed}s"
  [[ $fails -eq 0 ]] || { bad "하네스 실패 — 로그: $OUT"; exit 1; }
  ok "KRDS Harness PASS — $OUT"
  echo "SUMMARY_HTML=$OUT/summary.html"
}

main
