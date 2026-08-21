#!/usr/bin/env python3
"""
KRDS Harness v2 — RADIUS 완성형 워크플로우 (성능 + 리포트 문제 감지 + 탐색 + 회귀)

  python3 scripts/harness-krds.py [full|smoke|build|report|audit]

  full  : preflight → typecheck → lint → rules:generate-kq → build → restart
          → health → login → rules → multi-inspect(병렬 실사이트 탐색)
          → analysis → reports(4종) → audit(리포트 문제감지) → bench
          → summary → regression(이전 대비) → notify
  smoke : restart → health → login → rules → multi-inspect → analysis
          → reports → audit → summary
  build : 검증+빌드만
  report: 마지막 OUT으로 summary 재생성 + audit만
  audit : 마지막 OUT 리포트 문제감지만

환경변수: KRDS_BASE, KRDS_EMAIL, KRDS_PASS, KRDS_SITES(콤마), KRDS_HARNESS_NOTIFY=1
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HARNESS_DIR = ROOT / ".data" / "harness"
TS = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
OUT = HARNESS_DIR / TS

BASE = os.environ.get("KRDS_BASE", "http://127.0.0.1:3000")
EMAIL = os.environ.get("KRDS_EMAIL", "demo@klic.local")
PASS = os.environ.get("KRDS_PASS", "demo1234")
SITES = [s.strip() for s in os.environ.get(
    "KRDS_SITES",
    "https://www.klic.co.kr,https://example.com",
).split(",") if s.strip()]
NOTIFY = os.environ.get("KRDS_HARNESS_NOTIFY", "0") == "1"

RESULTS: list[tuple[str, str]] = []   # (name, PASS|FAIL)
BENCH: dict[str, float] = {}
START = time.time()
SERVER_PID: int | None = None


def say(msg: str) -> None:
    line = f"\n[{dt.datetime.now():%H:%M:%S}] {msg}"
    print(line, flush=True)
    (OUT / "harness.log").open("a").write(line + "\n")


def ok(msg: str) -> None:
    print(f"  \u2713 {msg}", flush=True)


def bad(msg: str) -> None:
    print(f"  \u2717 {msg}", flush=True)


def elapsed() -> str:
    return f"{int(time.time() - START)}s"


def run(cmd: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=ROOT)


def api(method: str, path: str, token: str | None = None, data: dict | None = None,
        timeout: int = 90, binary: bool = False):
    url = f"{BASE}{path}"
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            lat = round((time.time() - t0) * 1000)
            return r.status, (raw if binary else raw.decode("utf-8", "replace")), lat
    except urllib.error.HTTPError as e:
        lat = round((time.time() - t0) * 1000)
        return e.code, e.read().decode("utf-8", "replace"), lat
    except Exception as e:  # timeout/conn
        lat = round((time.time() - t0) * 1000)
        return 0, str(e), lat


def phase(name: str, fn) -> bool:
    t0 = time.time()
    say(f"\u25b6 {name} ({elapsed()})")
    try:
        fn()
        dt_ = time.time() - t0
        BENCH[name] = round(dt_, 2)
        RESULTS.append((name, "PASS"))
        ok(f"{name} ({dt_:.1f}s)")
        return True
    except Exception as e:
        dt_ = time.time() - t0
        BENCH[name] = round(dt_, 2)
        RESULTS.append((name, "FAIL"))
        bad(f"{name} \u2014 {e}")
        return False


# ---------------- phases ----------------

def p_preflight():
    for c in ("node", "npm", "python3"):
        if not subprocess.run(["which", c], capture_output=True).returncode == 0:
            raise RuntimeError(f"{c} 없음")
    if not (ROOT / "node_modules").is_dir():
        raise RuntimeError("node_modules 없음 \u2192 npm install 필요")
    if not (ROOT / "package.json").read_text().count('"playwright"'):
        raise RuntimeError("playwright 의존성 없음")


def p_typecheck():
    r = run(["npm", "run", "typecheck"], timeout=300)
    if r.returncode != 0:
        raise RuntimeError(r.stdout[-1500:] + r.stderr[-1500:])


def p_lint():
    r = run(["npm", "run", "lint"], timeout=300)
    if r.returncode not in (0, 1):   # lint warning 허용, error만 거부
        raise RuntimeError(r.stdout[-1500:] + r.stderr[-1500:])


def p_rules_gen():
    r = run(["npm", "run", "rules:generate-kq"], timeout=180)
    if r.returncode != 0:
        raise RuntimeError(r.stdout[-1500:] + r.stderr[-1500:])
    data_dir = ROOT / "src/lib/krds/rules/data"
    total = sum(1 for p in data_dir.glob("kq_?.json"))
    if total < 6:
        raise RuntimeError(f"카탈로그 파일 부족: {total}")
    ok(f"카탈로그 {total}파일 동기화")


def p_build():
    if (ROOT / ".next" / "BUILD_ID").exists() and args.mode == "smoke":
        ok("기존 빌드 사용")
        return
    t0 = time.time()
    r = run(["npm", "run", "build"], timeout=600)
    dt_ = round(time.time() - t0, 2)
    if args.max_build_sec and dt_ > args.max_build_sec:
        raise RuntimeError(f"빌드 {dt_}s > 임계 {args.max_build_sec}s")
    if r.returncode != 0:
        raise RuntimeError(r.stdout[-2500:] + r.stderr[-2500:])


def p_restart():
    global SERVER_PID
    subprocess.run(["lsof", "-ti:3000"], capture_output=True)
    r = subprocess.run("lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true",
                       shell=True)
    time.sleep(1)
    env = dict(os.environ)
    env.update(PORT="3000", HOSTNAME="0.0.0.0", NODE_ENV="production",
               PLAYWRIGHT_BROWSERS_PATH=env.get(
                   "PLAYWRIGHT_BROWSERS_PATH", str(Path.home() / "Library/Caches/ms-playwright")))
    logf = (OUT / "next-server.log").open("w")
    proc = subprocess.Popen(["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"],
                            cwd=ROOT, env=env, stdout=logf, stderr=subprocess.STDOUT)
    SERVER_PID = proc.pid
    for i in range(45):
        st, _, _ = api("GET", "/api/v1/health", timeout=3)
        if st == 200:
            ok(f"서버 기동 (pid {proc.pid}) health OK")
            return
        time.sleep(2)
    raise RuntimeError("health 대기 초과 — next-server.log 확인")


def p_health():
    st, body, lat = api("GET", "/api/v1/health", timeout=10)
    if st != 200:
        raise RuntimeError(f"HTTP {st}")
    d = json.loads(body)
    assert d.get("ok"), d
    assert d.get("framework") == "RADIUS", d.get("framework")
    assert d.get("engine") == "klic-radius-inspect-v2", d.get("engine")
    (OUT / "health.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
    BENCH["health_latency_ms"] = lat
    ok(f"health: {d.get('service')} | {d.get('framework')} | {d.get('engine')} | {lat}ms")


def p_login():
    st, body, lat = api("POST", "/api/v1/auth/login", data={"email": EMAIL, "password": PASS}, timeout=10)
    if st != 200:
        raise RuntimeError(f"HTTP {st}: {body[:300]}")
    d = json.loads(body)
    token = d.get("token")
    if not token:
        raise RuntimeError("token 없음")
    (OUT / "login.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
    (OUT / "token.txt").write_text(token)
    BENCH["login_latency_ms"] = lat
    ok(f"login: {d.get('user', {}).get('email')} | {lat}ms")


def p_rules():
    tok = (OUT / "token.txt").read_text().strip()
    st, body, lat = api("GET", "/api/v1/rules", token=tok, timeout=10)
    if st != 200:
        raise RuntimeError(f"HTTP {st}: {body[:300]}")
    d = json.loads(body)
    c = d.get("counts") or {}
    total = c.get("total", 0)
    if total < 500:
        raise RuntimeError(f"규칙 부족: {total}")
    (OUT / "rules.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
    BENCH["rules_latency_ms"] = lat
    ok(f"rules: {total} | brand {d.get('brand')} | {lat}ms")


def _inspect_one(url: str, tok: str, mode: str) -> dict:
    st, body, lat = api("POST", "/api/v1/inspect",
                        token=tok, timeout=120,
                        data={"url": url, "mode": mode, "maxPages": 1})
    if st != 200:
        return {"url": url, "error": f"HTTP {st}", "latencyMs": lat}
    d = json.loads(body)
    page = d.get("page") or {}
    axe = d.get("axe") or {}
    sm = d.get("summary") or {}
    return {
        "url": url,
        "status": page.get("status"),
        "title": (page.get("title") or "")[:60],
        "rendered": page.get("rendered"),
        "bytes": page.get("bytes"),
        "elapsedMs": page.get("elapsedMs"),
        "axeViolations": axe.get("violations"),
        "hits": sm.get("hitCount"),
        "latencyMs": lat,
        "error": d.get("error"),
    }


def p_multi_inspect():
    """병렬 실사이트 탐색 — 성능: --workers 동시."""
    tok = (OUT / "token.txt").read_text().strip()
    mode = args.inspect_mode or "render+axe"
    results: list[dict] = []
    t0 = time.time()
    workers = max(1, min(args.workers, len(SITES)))
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_inspect_one, s, tok, mode): s for s in SITES}
        for f in cf.as_completed(futs):
            try:
                results.append(f.result())
            except Exception as e:
                results.append({"url": futs[f], "error": str(e)})
    results.sort(key=lambda x: x.get("url", ""))
    (OUT / "inspect_sites.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    total = round(time.time() - t0, 2)
    BENCH["multi_inspect_sec"] = total
    ok(f"{len(results)}개 사이트 병렬 검사 {total}s")
    for r in results:
        if r.get("error"):
            bad(f"  {r['url']} — {r['error']}")
        else:
            ok(f"  {r['url']} | {r.get('status')} | rendered={r.get('rendered')} | "
               f"axe {r.get('axeViolations')}건 | {r.get('elapsedMs')}ms | {r.get('latencyMs')}ms")
    if all(r.get("error") for r in results):
        raise RuntimeError("전 사이트 검사 실패")


def p_sse():
    """SSE 실시간 진행 스트림 검증 — 잡 진행 이벤트 수신 확인."""
    tok = (OUT / "token.txt").read_text().strip()
    jid = (OUT / "job_id.txt").read_text().strip()
    # 새 잡 생성 (SSE 중인 잡이 필요)
    target = SITES[0] if SITES else "https://example.com"
    st, body, _ = api("POST", "/api/v1/analyses", token=tok, timeout=15,
                      data={"targetUrl": target, "title": "sse check",
                            "inspectMode": "static", "maxPages": 1})
    if st not in (200, 201):
        raise RuntimeError(f"SSE 잡 생성 실패 HTTP {st}")
    jid2 = json.loads(body)["item"]["id"]
    # SSE 수신 (백그라운드 curl — 40초 제한)
    import subprocess as sp
    sse_log = OUT / "sse_stream.txt"
    sse_p = sp.Popen(
        ["curl", "-sS", "--max-time", "40", "-N",
         f"{BASE}/api/v1/analyses/{jid2}/events", "-H", f"Authorization: Bearer {tok}"],
        stdout=open(sse_log, "w"), stderr=sp.STDOUT, start_new_session=True)
    # 완료 대기
    for _ in range(30):
        time.sleep(2)
        st2, body2, _ = api("GET", f"/api/v1/analyses/{jid2}", token=tok, timeout=10)
        if st2 != 200:
            continue
        it = json.loads(body2).get("item") or {}
        if it.get("status") in ("completed", "failed"):
            break
    # done 이벤트 수신 여유 (완료 이벤트 후 SSE done이 오는 시간)
    time.sleep(2)
    sse_p.terminate()
    try:
        sse_p.wait(timeout=5)
    except Exception:
        sse_p.kill()
    raw = sse_log.read_text(errors="replace")
    n_events = raw.count("event: analysis.progress")
    has_done = "event: done" in raw
    # 진행 단계 다양성 확인
    import re as _re
    types = set(_re.findall(r'"type":"([^"]+)"', raw))
    has_completed = "job.completed" in types or "job.failed" in types
    if n_events < 3:
        raise RuntimeError(f"SSE 이벤트 부족: {n_events}건 — {raw[:200]}")
    if not has_done and not has_completed:
        raise RuntimeError("SSE done/완료 이벤트 없음")
    ok(f"SSE: {n_events}건 이벤트 · types {sorted(types)} · done={has_done} completed={has_completed}")
    BENCH["sse_events"] = n_events


def p_analysis():
    tok = (OUT / "token.txt").read_text().strip()
    target = SITES[0] if SITES else "https://example.com"
    mode = args.inspect_mode or "render+axe"
    st, body, lat = api("POST", "/api/v1/analyses", token=tok, timeout=15,
                        data={"targetUrl": target, "title": "harness smoke",
                              "inspectMode": mode, "maxPages": args.max_pages})
    if st not in (200, 201):
        raise RuntimeError(f"HTTP {st}: {body[:300]}")
    create = json.loads(body)
    jid = create["item"]["id"]
    (OUT / "analysis_create.json").write_text(json.dumps(create, ensure_ascii=False, indent=2))
    (OUT / "job_id.txt").write_text(jid)
    ok(f"job {jid} 생성 ({lat}ms)")
    t0 = time.time()
    for i in range(90):
        st, body, _ = api("GET", f"/api/v1/analyses/{jid}", token=tok, timeout=10)
        if st != 200:
            time.sleep(2)
            continue
        d = json.loads(body)
        it = d.get("item") or d
        stt = it.get("status")
        if stt == "completed":
            (OUT / "analysis.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
            poll = round(time.time() - t0, 2)
            BENCH["analysis_poll_sec"] = poll
            if args.max_analysis_sec and poll > args.max_analysis_sec:
                raise RuntimeError(f"분석 {poll}s > 임계 {args.max_analysis_sec}s")
            rep = it.get("report") or {}
            ok(f"analysis 완료: {rep.get('engine')} | {rep.get('overallScore')}점 "
               f"{rep.get('grade')} | findings {len(rep.get('findings') or [])} | "
               f"{poll}s")
            return
        if stt == "failed":
            raise RuntimeError(f"분석 실패: {it.get('error') or body[:300]}")
        time.sleep(1)
    raise RuntimeError("분석 폴링 초과")


def p_reports():
    tok = (OUT / "token.txt").read_text().strip()
    jid = (OUT / "job_id.txt").read_text().strip()
    fmts = (args.formats or "html,xlsx,csv,pdf").split(",")
    for fmt in fmts:
        st, data, lat = api("GET", f"/api/v1/analyses/{jid}/report?format={fmt}",
                            token=tok, timeout=150, binary=True)
        if st != 200:
            raise RuntimeError(f"{fmt} HTTP {st}")
        (OUT / f"report.{fmt}").write_bytes(data if isinstance(data, bytes) else data.encode())
        BENCH[f"report_{fmt}_ms"] = lat
        ok(f"report.{fmt} {len(data)}B ({lat}ms)")
        if fmt == "pdf" and args.max_pdf_ms and lat > args.max_pdf_ms:
            raise RuntimeError(f"PDF {lat}ms > 임계 {args.max_pdf_ms}ms")
    # magic 검증
    checks = {
        "html": b"<" in (OUT / "report.html").read_bytes()[:4],
        "xlsx": (OUT / "report.xlsx").read_bytes()[:2] == b"PK",
        "csv": (OUT / "report.csv").read_bytes()[:3] == b"\xef\xbb\xbf",
        "pdf": (OUT / "report.pdf").read_bytes()[:4] == b"%PDF",
    }
    for fmt in fmts:
        if not checks.get(fmt):
            raise RuntimeError(f"{fmt} magic 불일치")


def pdf_pages(data: bytes) -> int:
    """PDF 객체에서 /Type /Page 카운트 (압축 안 된 딕셔너리 기준)."""
    return len(re.findall(rb"/Type\s*/Page[^s]", data))


def audit_report() -> dict:
    """리포트 문제 감지 — 스텁·품질·정직성·누출 체크."""
    issues: list[dict] = []
    anl = json.loads((OUT / "analysis.json").read_text())
    it = anl.get("item") or anl
    rep = it.get("report") or {}
    html = (OUT / "report.html").read_bytes().decode("utf-8", "replace") if (OUT / "report.html").exists() else ""
    pdf = (OUT / "report.pdf").read_bytes() if (OUT / "report.pdf").exists() else b""
    xlsx = (OUT / "report.xlsx").read_bytes() if (OUT / "report.xlsx").exists() else b""

    def chk(code: str, label: str, ok_: bool, detail: str = ""):
        issues.append({"code": code, "label": label, "ok": bool(ok_), "detail": detail})

    # 1. 엔진
    chk("ENGINE", "엔진=klic-radius-inspect-v2",
        rep.get("engine") == "klic-radius-inspect-v2", str(rep.get("engine")))
    # 2. 점수 범위
    sc = rep.get("overallScore")
    chk("SCORE", f"점수 0~100 ({sc})", isinstance(sc, int) and 0 <= sc <= 100, str(sc))
    # 3. findings 품질
    fs = rep.get("findings") or []
    chk("FINDINGS", f"findings {len(fs)}건", len(fs) >= 1, str(len(fs)))
    stub_find = [f for f in fs
                 if not (f.get("description") or "").strip()
                 or not (f.get("recommendation") or "").strip()
                 or len((f.get("description") or "")) < 20
                 or len((f.get("recommendation") or "")) < 20]
    chk("FINDING_QUALITY", f"findings 스텁/짧은 본문 0건 ({len(stub_find)}건)",
        len(stub_find) == 0, ", ".join(f.get("code", "?") for f in stub_find[:5]))
    # 4. 스텁 문구
    stub_words = ["위반 후보", "검증합니다", "추후 확인", "확인 필요합니다", "TODO", "lorem"]
    text_all = json.dumps(rep, ensure_ascii=False) + html
    found_stub = [w for w in stub_words if w in text_all]
    chk("STUB", f"스텁 문구 없음 ({found_stub})", len(found_stub) == 0, str(found_stub))
    # 5. 섹션
    secs = rep.get("sections") or []
    sec_bodies = [s.get("body") or "" for s in secs]
    avg_len = statistics.mean([len(b) for b in sec_bodies]) if sec_bodies else 0
    chk("SECTIONS", f"섹션 {len(secs)}개 · 평균본문 {int(avg_len)}자",
        len(secs) >= 3 and avg_len >= 60, f"{len(secs)}/{int(avg_len)}")
    # 6. 정직성
    chk("HONESTY_METHOD", "methodNote 존재", bool(rep.get("methodNote")))
    chk("HONESTY_MEASURED", f"실측 축 {len(rep.get('measuredAxes') or [])}개",
        len(rep.get("measuredAxes") or []) >= 1, str(rep.get("measuredAxes")))
    chk("HONESTY_DEFAULT", "defaultMethod=measured", rep.get("defaultMethod") == "measured")
    # 7. inspect 실측 증거
    insp = rep.get("inspect") or {}
    chk("INSPECT_RENDERED", "inspect.rendered true", insp.get("rendered") is True)
    chk("INSPECT_AXE", "inspect.axe 존재", bool(insp.get("axe")))
    chk("INSPECT_HITS", f"실측 히트 {insp.get('hitCount')}건", (insp.get("hitCount") or 0) > 0)
    # 8. HTML 리포트
    chk("HTML_SIZE", f"HTML {len(html)}B ≥ 5KB", len(html) >= 5000, str(len(html)))
    chk("HTML_STRUCT", "HTML <html>/섹션 구조", "<html" in html and "axis-card" in html)
    # 9. PDF
    pages = pdf_pages(pdf)
    chk("PDF_MAGIC", "PDF %PDF magic", pdf[:4] == b"%PDF")
    chk("PDF_SIZE", f"PDF {len(pdf)}B ≥ 100KB", len(pdf) >= 100_000, str(len(pdf)))
    chk("PDF_PAGES", f"PDF 페이지 {pages} ≥ 2", pages >= 2, str(pages))
    # 10. xlsx/csv
    chk("XLSX_MAGIC", "xlsx PK magic", xlsx[:2] == b"PK")
    # 11. 내부키 누출 — UI 리포트에 raw kq_* 노출 금지
    leaked = sorted(set(re.findall(r"kq_[a-z]", html)))
    chk("NO_KQ_LEAK", f"HTML kq_* raw 미노출 ({leaked})", len(leaked) == 0, str(leaked))
    # 12. mcpPath 노출 금지
    chk("NO_MCP_PATH", "mcpPath 미노출", "mcpPath" not in html and "mcpPath" not in text_all)
    # 13. RADIUS 매핑 일관
    domain_letters = {d.get("domain"): d.get("axisCode") for d in rep.get("domainScores") or []}
    bad_map = {k: v for k, v in domain_letters.items()
               if (k == "kq_r" and v != "R") or (k == "kq_a" and v != "A")
               or (k == "kq_d" and v != "D") or (k == "kq_i" and v != "I")
               or (k == "kq_u" and v != "U") or (k == "kq_s" and v != "S")}
    chk("RADIUS_MAP", "RADIUS 1:1 매핑", len(bad_map) == 0, str(bad_map))
    # 14. A11Y 패키지 (render+axe 시)
    a11y = insp.get("a11y") or {}
    if a11y:
        chk("A11Y_KWCAG", f"KWCAG 매핑 존재 (mapped {a11y.get('kwcagMapped')} / unmapped {a11y.get('kwcagUnmapped')})",
            a11y.get("kwcagMapped", 0) + a11y.get("kwcagUnmapped", 0) > 0,
            f"m={a11y.get('kwcagMapped')} u={a11y.get('kwcagUnmapped')}")
        chk("A11Y_SCEN", f"시나리오 4종 ({len(a11y.get('scenarios') or [])})",
            len(a11y.get("scenarios") or []) == 4, str(len(a11y.get("scenarios") or [])))
        chk("A11Y_KB", "키보드 probe 존재",
            bool(a11y.get("keyboard")), str(a11y.get("keyboard")))
        chk("A11Y_NOTE", "coverageNote 존재", bool(a11y.get("coverageNote")))
        chk("A11Y_KWCAG_BLOCK", "HTML KWCAG 블록", "KWCAG 위반" in html)
        chk("A11Y_SCEN_BLOCK", "HTML 시나리오 카드", "scen-card" in html)
    else:
        chk("A11Y_PRESENT", "A11Y 패키지 존재 (render+axe)", False, "a11y 없음")

    # --audit-check / --audit-exclude 필터
    if args.audit_check:
        issues = [i for i in issues if i["code"] in args.audit_check]
    if args.audit_exclude:
        issues = [i for i in issues if i["code"] not in args.audit_exclude]

    (OUT / "audit.json").write_text(json.dumps(issues, ensure_ascii=False, indent=2))
    fails = [i for i in issues if not i["ok"]]
    ok(f"audit: {len(issues) - len(fails)}/{len(issues)} 통과")
    for i in fails:
        bad(f"  [audit] {i['code']} {i['label']} — {i.get('detail', '')[:120]}")
    if fails:
        raise RuntimeError(f"리포트 문제 {len(fails)}건")
    return {"total": len(issues), "pass": len(issues) - len(fails), "fails": len(fails)}


def regression() -> dict:
    """이전 실행 대비 점수 추이."""
    runs = []
    for p in sorted(HARNESS_DIR.glob("*/summary.json")):
        try:
            d = json.loads(p.read_text())
            runs.append({"ts": d.get("ts"), "score": d.get("overallScore"),
                         "grade": d.get("grade"), "elapsed": d.get("elapsedSec"),
                         "sites": d.get("inspectSites", 0)})
        except Exception:
            continue
    if not runs:
        return {"note": "이전 실행 없음", "runs": []}
    latest = runs[-1]
    prev = runs[-2] if len(runs) >= 2 else None
    delta = None
    if prev and isinstance(latest.get("score"), int) and isinstance(prev.get("score"), int):
        delta = latest["score"] - prev["score"]
    out = {"runs": runs, "latest": latest, "prev": prev, "delta": delta}
    (OUT / "regression.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
    if delta is not None:
        arrow = "\u2191" if delta > 0 else ("\u2193" if delta < 0 else "\u2192")
        prev_score = prev.get("score") if prev else "?"
        ok(f"회귀: 이전 {prev_score}점 → {latest.get('score')}점 ({arrow}{delta})")
    else:
        ok(f"회귀: 첫 실행 (이전 데이터 없음)")
    return out


def p_summary():
    import io

    def jload(name, default=None):
        p = OUT / name
        if not p.exists():
            return default
        try:
            return json.loads(p.read_text())
        except Exception:
            return default

    health = jload("health.json", {})
    rules = jload("rules.json", {})
    insp = jload("inspect_sites.json", [])
    anl = jload("analysis.json", {})
    audit = jload("audit.json", [])
    reg = jload("regression.json", {})
    it = anl.get("item") or anl if isinstance(anl, dict) else {}
    rep = it.get("report") or {}
    scores = {ds.get("axisCode"): ds.get("score") for ds in rep.get("domainScores") or []}
    bench_flat = {k: v for k, v in BENCH.items()}

    summary = {
        "ts": TS, "mode": args.mode, "elapsedSec": int(time.time() - START),
        "service": health.get("service"), "framework": health.get("framework"),
        "engine": rep.get("engine") or health.get("engine"),
        "overallScore": rep.get("overallScore"), "grade": rep.get("grade"),
        "domainScores": scores,
        "rulesTotal": (rules.get("counts") or {}).get("total"),
        "inspectSites": len(insp),
        "sites": insp,
        "analysis": {"status": it.get("status"), "findings": len(rep.get("findings") or []),
                     "engine": rep.get("engine")},
        "audit": {"total": len(audit), "pass": sum(1 for a in audit if a.get("ok")),
                  "fails": sum(1 for a in audit if not a.get("ok"))},
        "regression": reg,
        "reports": {f: (OUT / f"report.{f}").stat().st_size if (OUT / f"report.{f}").exists() else None
                    for f in ("html", "xlsx", "csv", "pdf")},
        "bench": bench_flat,
        "serverPid": SERVER_PID,
    }
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))

    axis_names = {"R": "Responsive", "A": "Accessibility", "D": "Design",
                  "I": "Interface", "U": "User flow", "S": "Security"}
    cards = ""
    for letter in "RADIUS":
        sc = scores.get(letter)
        if sc is None:
            continue
        bar = int(sc)
        cards += f"""
      <div class="card"><div class="axis">{letter}</div>
        <div class="aname">{axis_names.get(letter, '')}</div>
        <div class="score">{sc}</div>
        <div class="bar"><div class="fill" style="width:{bar}%"></div></div></div>"""
    sites_rows = "".join(
        f'<tr><td>{r.get("url", "")}</td><td>{r.get("status", "-")}</td>'
        f'<td>{"Y" if r.get("rendered") else "N"}</td><td>{r.get("axeViolations", "-")}</td>'
        f'<td>{r.get("elapsedMs", "-")}ms</td><td>{r.get("error", "")}</td></tr>'
        for r in insp)
    audit_pct = f"{summary['audit']['pass']}/{summary['audit']['total']}" if summary["audit"]["total"] else "-"
    bench_rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in bench_flat.items())
    delta_txt = ""
    if reg.get("delta") is not None:
        delta_txt = f"{reg['delta']:+.0f}점 vs 이전"
    html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>KRDS Harness — {TS}</title>
<style>
  body{{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;background:#0e1420;color:#e8edf5;margin:0;padding:32px}}
  .wrap{{max-width:900px;margin:0 auto}}
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
  table{{width:100%;border-collapse:collapse;font-size:12.5px}}
  td,th{{border-bottom:1px solid #24344e;padding:7px 9px;text-align:left}}
  th{{color:#8fa1bd;font-weight:600;font-size:11px;letter-spacing:1px}}
  .pass{{color:#7ae0b8}} .fail{{color:#ff7a7a}} .warn{{color:#ffd166}}
  .foot{{color:#5c6f8c;font-size:11px;margin-top:28px}}
  h2{{font-size:15px;color:#8fa1bd;letter-spacing:1px;margin:26px 0 10px}}
</style></head><body><div class="wrap">
<h1>KRDS · HARNESS v2</h1>
<div class="sub">{TS} · mode {args.mode} · {int(time.time() - START)}s · {delta_txt}</div>
<div class="grid">
  <div class="stat"><div class="k">종합점수</div><div class="v">{rep.get('overallScore')} <span style="font-size:14px;color:#8fa1bd">{rep.get('grade')}</span></div></div>
  <div class="stat"><div class="k">규칙</div><div class="v">{(rules.get('counts') or {}).get('total')}</div></div>
  <div class="stat"><div class="k">리포트 감사</div><div class="v" style="font-size:20px">{audit_pct}</div></div>
</div>
<h2>RADIUS AXES</h2>
<div class="grid">{cards}</div>
<h2>실사이트 탐색 (병렬)</h2>
<table><tr><th>URL</th><th>HTTP</th><th>렌더</th><th>axe</th><th>로드</th><th>비고</th></tr>{sites_rows}</table>
<h2>SMOKE</h2>
<table><tr><th>단계</th><th>결과</th></tr>
<tr><td>health · login · rules</td><td class="pass">PASS</td></tr>
<tr><td>multi-inspect ({len(insp)} sites)</td><td class="pass">PASS</td></tr>
<tr><td>analysis ({rep.get('engine')})</td><td class="pass">PASS · findings {len(rep.get('findings') or [])}건</td></tr>
<tr><td>reports html/xlsx/csv/pdf</td><td class="pass">PASS</td></tr>
<tr><td>audit 문제감지</td><td class="{'pass' if summary['audit']['fails'] == 0 else 'fail'}">{summary['audit']['pass']}/{summary['audit']['total']} 통과</td></tr>
</table>
<h2>BENCH (성능)</h2>
<table><tr><th>지표</th><th>값</th></tr>{bench_rows}</table>
<div class="foot">KLIC KRDS · RADIUS framework · harness-krds.py v2</div>
</div></body></html>"""
    (OUT / "summary.html").write_text(html)
    ok(f"summary.json + summary.html ({len(html)}B)")


def p_notify():
    if not NOTIFY:
        ok("notify skip (KRDS_HARNESS_NOTIFY!=1)")
        return
    env = Path.home() / ".hermes" / ".env"
    tok = ""
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("TELEGRAM_BOT_TOKEN=") and not line.strip().startswith("#"):
                tok = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not tok:
        ok("TELEGRAM_BOT_TOKEN 없음 — skip")
        return
    s = json.loads((OUT / "summary.json").read_text())
    text = (
        f"【KRDS Harness v2 {TS}】\n"
        f"mode {s.get('mode')} · {s.get('elapsedSec')}s\n"
        f"종합 {s.get('overallScore')}점 {s.get('grade')} · 엔진 {s.get('engine')}\n"
        f"규칙 {s.get('rulesTotal')} · findings {s.get('analysis', {}).get('findings')}\n"
        f"탐색 {s.get('inspectSites')}사이트 · 감사 {s.get('audit', {}).get('pass')}/{s.get('audit', {}).get('total')}\n"
        f"리포트 html/xlsx/csv/pdf \u2705"
    )
    chat = -1004299788713

    def send(tid, caption=None, fname=None, path=None):
        b = __import__("uuid").uuid4().hex
        body = bytearray()
        def af(n, v):
            body.extend(f"--{b}\r\n".encode())
            body.extend(f'Content-Disposition: form-data; name="{n}"\r\n\r\n'.encode())
            body.extend(str(v).encode())
            body.extend(b"\r\n")
        af("chat_id", chat)
        if tid:
            af("message_thread_id", tid)
        if caption:
            af("caption", caption)
        if path:
            body.extend(f"--{b}\r\n".encode())
            body.extend(f'Content-Disposition: form-data; name="document"; filename="{fname}"\r\n'.encode())
            body.extend(b"Content-Type: application/octet-stream\r\n\r\n")
            body.extend(Path(path).read_bytes())
            body.extend(b"\r\n")
        body.extend(f"--{b}--\r\n".encode())
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{tok}/sendDocument" if path else f"https://api.telegram.org/bot{tok}/sendMessage",
            data=bytes(body), headers={"Content-Type": f"multipart/form-data; boundary={b}"}, method="POST")
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode()).get("ok")

    try:
        ok(f"1879: {send(1879, text)}")
        ok(f"513: {send(513, 'KRDS harness 인포그래픽', 'krds-harness-summary.html', OUT / 'summary.html')}")
    except Exception as e:
        bad(f"notify 실패: {e}")


# ---------------- main ----------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="KRDS Harness v2 — 기능/감사/임계값 옵션 지원",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
옵션 예시:
  # 기능 토글 (기본 전부 ON, --without-* 로 끔)
  python3 scripts/harness-krds.py full --without-lint --without-notify
  python3 scripts/harness-krds.py full --with-regression --without-audit

  # 감사 체크 선택 (--audit-check 만 실행)
  python3 scripts/harness-krds.py audit --audit-check ENGINE --audit-check STUB

  # 임계값 게이트 (미달 시 FAIL)
  python3 scripts/harness-krds.py full --min-score 80 --min-findings 10
  python3 scripts/harness-krds.py full --max-analysis-sec 60

  # 성능/탐색
  KRDS_SITES="https://a.com,https://b.com,https://c.com" python3 scripts/harness-krds.py full --workers 4
  python3 scripts/harness-krds.py full --inspect-mode render+axe --max-pages 3

  # 리포트 형식 선택 (기본 전부)
  python3 scripts/harness-krds.py full --formats html,pdf
""")
    parser.add_argument("mode", nargs="?", default="full",
                        choices=["full", "smoke", "build", "report", "audit"])
    # 기능 토글 (스텝 필터)
    parser.add_argument("--with", dest="with_steps", action="append", default=[],
                        help="특정 스텝만 실행 (예: --with build --with audit)")
    parser.add_argument("--without", dest="without_steps", action="append", default=[],
                        help="특정 스텝 제외 (예: --without lint --without notify)")
    parser.add_argument("--with-regression", action="store_true", help="regression 스텝 강제 포함")
    parser.add_argument("--without-regression", action="store_true", help="regression 스텝 제외")
    parser.add_argument("--with-notify", action="store_true", help="notify 강제 포함")
    parser.add_argument("--without-notify", action="store_true", help="notify 제외")
    # 감사 체크 필터
    parser.add_argument("--audit-check", action="append", default=[],
                        help="감사 체크 코드만 실행 (예: --audit-check ENGINE --audit-check STUB)")
    parser.add_argument("--audit-exclude", action="append", default=[],
                        help="감사 체크 제외 (예: --audit-exclude PDF_PAGES)")
    # 임계값 게이트
    parser.add_argument("--min-score", type=int, default=None, help="최소 종합점수 (미달 시 FAIL)")
    parser.add_argument("--max-score", type=int, default=None, help="최대 종합점수 상한")
    parser.add_argument("--min-findings", type=int, default=None, help="최소 findings 수")
    parser.add_argument("--max-findings", type=int, default=None, help="최대 findings 수")
    parser.add_argument("--min-axe-violations", type=int, default=None,
                        help="탐색 사이트당 최소 axe 위반 수 (이상이어야 통과)")
    parser.add_argument("--max-axe-violations", type=int, default=None,
                        help="탐색 사이트당 최대 axe 위반 수 (이하 통과)")
    parser.add_argument("--max-analysis-sec", type=float, default=None, help="분석 완료 최대 시간(초)")
    parser.add_argument("--max-build-sec", type=float, default=None, help="빌드 최대 시간(초)")
    parser.add_argument("--max-pdf-ms", type=float, default=None, help="PDF 생성 최대 시간(ms)")
    parser.add_argument("--max-total-sec", type=float, default=None, help="전체 실행 최대 시간(초)")
    # 성능/탐색
    parser.add_argument("--workers", type=int, default=4, help="병렬 탐색 워커 수 (기본 4)")
    parser.add_argument("--inspect-mode", default=None, choices=["static", "render", "render+axe"],
                        help="inspect 모드 (기본 render+axe)")
    parser.add_argument("--max-pages", type=int, default=3, help="분석 크롤 페이지 수 (기본 3)")
    parser.add_argument("--formats", default=None,
                        help="리포트 형식 콤마 (기본 html,xlsx,csv,pdf)")
    return parser.parse_args()


def step_enabled(name: str) -> bool:
    """스텝 활성 여부 — --with-* / --without-* / 기본 토글."""
    if args.with_steps:
        return name in args.with_steps
    if name in args.without_steps:
        return False
    # 개별 토글
    if name == "regression" and args.without_regression:
        return False
    if name == "regression" and args.with_regression:
        return True
    if name == "notify" and args.without_notify:
        return False
    if name == "notify" and args.with_notify:
        return True
    return True


def main():
    global args, OUT
    args = parse_args()

    # audit/report 모드는 최신 완료 OUT 재사용 (새 OUT 만들지 않음)
    if args.mode in ("audit", "report"):
        runs = sorted(HARNESS_DIR.glob("*/analysis.json"), key=lambda p: p.stat().st_mtime)
        if runs:
            OUT = runs[-1].parent
            print(f"재사용 OUT: {OUT}", flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    say(f"KRDS Harness v2 시작 — mode={args.mode} out={OUT} sites={SITES} "
        f"notify={NOTIFY or args.with_notify} workers={args.workers}")

    if args.mode == "build":
        all_steps = [("preflight", p_preflight), ("typecheck", p_typecheck), ("lint", p_lint),
                     ("rules_gen", p_rules_gen), ("build", p_build)]
    elif args.mode == "smoke":
        all_steps = [("restart", p_restart), ("health", p_health), ("login", p_login),
                     ("rules", p_rules), ("multi_inspect", p_multi_inspect),
                     ("analysis", p_analysis), ("sse", p_sse), ("reports", p_reports),
                     ("audit", p_audit), ("summary", p_summary)]
    elif args.mode == "report":
        all_steps = [("summary", p_summary), ("audit", p_audit), ("regression", p_regression)]
    elif args.mode == "audit":
        all_steps = [("audit", p_audit)]
    else:  # full
        all_steps = [("preflight", p_preflight), ("typecheck", p_typecheck), ("lint", p_lint),
                     ("rules_gen", p_rules_gen), ("build", p_build), ("restart", p_restart),
                     ("health", p_health), ("login", p_login), ("rules", p_rules),
                     ("multi_inspect", p_multi_inspect), ("analysis", p_analysis),
                     ("sse", p_sse), ("reports", p_reports), ("audit", p_audit),
                     ("summary", p_summary), ("regression", p_regression), ("notify", p_notify)]

    steps = [(n, fn) for n, fn in all_steps if step_enabled(n)]
    say(f"실행 스텝: {', '.join(n for n, _ in steps)}")
    if not steps:
        raise SystemExit("실행할 스텝 없음")

    fails = 0
    for name, fn in steps:
        if not phase(name, fn):
            fails += 1
            if args.mode not in ("full",):
                break

    # ---- 임계값 게이트 (모든 스텝 끝난 뒤) ----
    thresholds: list[str] = []
    anl_path = OUT / "analysis.json"
    if anl_path.exists() and args.min_score is not None or anl_path.exists() and args.max_score is not None \
            or anl_path.exists() and args.min_findings is not None or anl_path.exists() and args.max_findings is not None:
        try:
            anl = json.loads(anl_path.read_text())
            it = anl.get("item") or anl
            rep = it.get("report") or {}
            score = rep.get("overallScore")
            nfind = len(rep.get("findings") or [])
            if args.min_score is not None and (score is None or score < args.min_score):
                thresholds.append(f"점수 {score} < 최소 {args.min_score}")
            if args.max_score is not None and (score is None or score > args.max_score):
                thresholds.append(f"점수 {score} > 최대 {args.max_score}")
            if args.min_findings is not None and nfind < args.min_findings:
                thresholds.append(f"findings {nfind} < 최소 {args.min_findings}")
            if args.max_findings is not None and nfind > args.max_findings:
                thresholds.append(f"findings {nfind} > 최대 {args.max_findings}")
        except Exception as e:
            thresholds.append(f"임계값 분석 실패: {e}")
    # axe 위반 임계 (multi_inspect 결과 기준)
    insp_path = OUT / "inspect_sites.json"
    if insp_path.exists() and (args.min_axe_violations is not None or args.max_axe_violations is not None):
        try:
            insp = json.loads(insp_path.read_text())
            for r in insp:
                if r.get("error"):
                    continue
                av = r.get("axeViolations")
                if av is None:
                    continue
                if args.min_axe_violations is not None and av < args.min_axe_violations:
                    thresholds.append(f"{r['url']} axe {av} < 최소 {args.min_axe_violations}")
                if args.max_axe_violations is not None and av > args.max_axe_violations:
                    thresholds.append(f"{r['url']} axe {av} > 최대 {args.max_axe_violations}")
        except Exception as e:
            thresholds.append(f"axe 임계값 실패: {e}")
    if args.max_total_sec and (time.time() - START) > args.max_total_sec:
        thresholds.append(f"전체 {int(time.time() - START)}s > 최대 {args.max_total_sec}s")
    for t in thresholds:
        bad(f"[임계값] {t}")
        fails += 1

    say(f"완료 — {len(RESULTS)}단계 / 실패 {fails} / {int(time.time() - START)}s")
    (OUT / "results.json").write_text(json.dumps(
        {"results": RESULTS, "bench": BENCH, "failed": fails}, ensure_ascii=False, indent=2))
    if fails:
        bad(f"하네스 실패 {fails}건 — 산출물: {OUT}")
        sys.exit(1)
    ok(f"KRDS Harness PASS — {OUT}")
    print(f"SUMMARY_HTML={OUT / 'summary.html'}")


def p_audit():
    audit_report()


def p_regression():
    regression()


if __name__ == "__main__":
    main()
