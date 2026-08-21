import type {
  AnalysisJob,
  DomainScore,
  Finding,
  FindingSeverity,
  RuleDomain,
} from "../types";
import { SEV_KO } from "../report-content";
import { BRAND } from "@/lib/brand";
import { KQ_META, RADIUS_ORDER, radiusLetter } from "../kq";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 사이트 맵 → D3 스타일 트리 SVG (depth = x 레이어, y = 자식 분포) */
function sitemapSvg(sm: {
  nodes: Array<{ url: string; label: string; depth: number; status: number }>;
  edges: Array<{ from: number; to: number }>;
  maxDepth: number;
}): string {
  const { nodes, edges } = sm;
  if (nodes.length === 0) return "";
  const W = 860;
  const H = Math.max(120, nodes.length * 26 + 60);
  const depthCount = sm.maxDepth + 1;
  const colW = W / depthCount;
  const xOf = (d: number) => Math.min(W - 90, colW * (d + 0.5) - 20);

  // y 위치 — depth별 노드 분포
  const byDepth: number[][] = Array.from({ length: depthCount }, () => []);
  nodes.forEach((n, i) => byDepth[n.depth]?.push(i));
  const yOf = (idx: number) => {
    const d = nodes[idx].depth;
    const arr = byDepth[d] || [];
    const pos = arr.indexOf(idx);
    const span = Math.max(40, H - 60);
    return 40 + (arr.length === 1 ? span / 2 : (span * (pos + 0.5)) / arr.length);
  };

  // 노드 색 — depth별
  const depthColors = ["#0b1f33", "#0080FF", "#64748b", "#c2410c"];
  const depthBg = ["#0b1f33", "#dbeafe", "#f1f5f9", "#ffedd5"];
  const depthTxt = ["#ffffff", "#1e3a8a", "#334155", "#7c2d12"];

  const edgePath = edges
    .map((e) => {
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (!a || !b) return "";
      const x1 = xOf(a.depth), y1 = yOf(e.from);
      const x2 = xOf(b.depth), y2 = yOf(e.to);
      const mx = (x1 + x2) / 2;
      return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="#cbd5e1" stroke-width="1.2"/>`;
    })
    .join("");

  const nodeG = nodes
    .map((n, i) => {
      const x = xOf(n.depth), y = yOf(i);
      const bg = depthBg[n.depth] || "#f1f5f9";
      const fg = depthTxt[n.depth] || "#334155";
      const label = n.label.length > 26 ? n.label.slice(0, 24) + "…" : n.label;
      return `
      <g>
        <circle cx="${x}" cy="${y}" r="9" fill="${depthColors[n.depth] || "#64748b"}" opacity="0.9"/>
        <rect x="${x + 13}" y="${y - 10}" width="${Math.min(130, label.length * 7.2 + 14)}" height="20" rx="5" fill="${bg}" stroke="${depthColors[n.depth] || "#64748b"}" stroke-width="1"/>
        <text x="${x + 20}" y="${y + 4}" font-size="10" fill="${fg}" font-weight="600">${esc(label)}</text>
      </g>`;
    })
    .join("");

  // depth 레이블
  const depthLabels = Array.from({ length: depthCount }, (_, d) => {
    const n = byDepth[d]?.length || 0;
    return `<text x="${xOf(d)}" y="22" font-size="9" fill="#94a3b8" font-weight="700" text-anchor="middle">D${d} · ${n}페이지</text>`;
  }).join("");

  return `
    <div class="smap-wrap">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="smap" role="img" aria-label="사이트 연계도">
        ${depthLabels}
        ${edgePath}
        ${nodeG}
      </svg>
      <p class="muted" style="margin-top:6px">사이트 맵 — 크롤 ${nodes.length}페이지 · 최대 D${sm.maxDepth} · 노드 색 = depth</p>
    </div>`;
}

function filterFindings(job: AnalysisJob, domain?: string | null): Finding[] {
  const all = job.report?.findings ?? [];
  if (!domain) return all;
  return all.filter((f) => f.domain === domain);
}

function gradeOf(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scoreColor(score: number): string {
  if (score >= 85) return "#0080FF";
  if (score >= 70) return "#256EF4";
  if (score >= 55) return "#64748b";
  return "#b91c1c";
}

function donutSvg(score: number, size = 120): string {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const col = scoreColor(score);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" class="donut">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="11"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${col}" stroke-width="11"
      stroke-dasharray="${dash} ${c}" stroke-linecap="round"
      transform="rotate(-90 50 50)"/>
    <text x="50" y="46" text-anchor="middle" font-size="22" font-weight="800" fill="#0f172a">${score}</text>
    <text x="50" y="62" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b">SCORE</text>
  </svg>`;
}

function axisBar(score: number, color: string): string {
  const w = Math.max(0, Math.min(100, score));
  return `<div class="abar"><span style="width:${w}%;background:${color}"></span></div>`;
}

function sevBadge(sev: FindingSeverity): string {
  return `<span class="badge sev-${sev}">${SEV_KO[sev]}</span>`;
}

function letterOf(domain: RuleDomain): string {
  return KQ_META[domain]?.radiusLetter || domain;
}

function domainLabel(d: DomainScore): string {
  const m = KQ_META[d.domain];
  return m ? `${m.radiusLetter} · ${m.radiusName || m.label}` : d.label;
}

export function buildHtmlReport(
  job: AnalysisJob,
  opts?: { domain?: string | null; baseUrl?: string; print?: boolean },
): string {
  const report = job.report;
  if (!report) throw new Error("report missing");
  const findings = filterFindings(job, opts?.domain);
  const g = gradeOf(report.overallScore);
  const crit = findings.filter((f) => f.severity === "critical").length;
  const ser = findings.filter((f) => f.severity === "serious").length;
  const mod = findings.filter((f) => f.severity === "moderate").length;
  const min = findings.filter((f) => f.severity === "minor").length;
  const generated = new Date(report.generatedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  const print = opts?.print === true;

  const byDomain = new Map(report.domainScores.map((d) => [d.domain, d]));
  const axisCards = RADIUS_ORDER.map((dom) => {
    const d = byDomain.get(dom);
    const m = KQ_META[dom];
    const score = d?.score ?? 0;
    const failed = d?.failed ?? 0;
    const method = d?.method === "measured" ? "실측" : "시뮬";
    const col = scoreColor(score);
    return `
      <div class="axis-card">
        <div class="axis-letter">${m.radiusLetter}</div>
        <div class="axis-body">
          <div class="axis-name">${esc(m.radiusName)}</div>
          <div class="axis-en">${esc(m.short)}</div>
          <div class="axis-score" style="color:${col}">${score}<small>점</small></div>
          ${axisBar(score, col)}
          <div class="axis-meta">
            <span class="pill ${d?.method === "measured" ? "pill-m" : "pill-s"}">${method}</span>
            <span>위반 ${failed}</span>
            <span>Crit ${d?.criticalFails ?? 0}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  const radarBars = RADIUS_ORDER.map((dom) => {
    const d = byDomain.get(dom);
    const m = KQ_META[dom];
    const score = d?.score ?? 0;
    const col = scoreColor(score);
    return `
      <div class="rbar-row">
        <div class="rbar-lab"><b>${m.radiusLetter}</b> ${esc(m.radiusName)}</div>
        <div class="rbar-track"><div class="rbar-fill" style="width:${score}%;background:${col}"></div></div>
        <div class="rbar-n" style="color:${col}">${score}</div>
      </div>`;
  }).join("");

  const topIssues = findings.slice(0, 12);

  // ---- A축 실측 패키지 (a11y aggregate) ----
  const a11y = report.inspect?.a11y;
  // ---- 사이트 연계도 (D3 스타일 SVG) ----
  const sm = report.inspect?.sitemap;
  const crawlNotes = report.inspect?.crawlNotes ?? [];
  const notesHtml = crawlNotes.length
    ? `<div class="crawl-note">크롤 제한 사유: ${crawlNotes.map((n) => esc(n)).join(" · ")}</div>`
    : "";
  const smBlock = sm && sm.nodes.length > 1
    ? `
    <section class="panel">
      <h2>사이트 연계도 <span class="sub">crawl ${sm.nodes.length}페이지 · D${sm.maxDepth}</span></h2>
      ${sitemapSvg(sm)}
      ${notesHtml}
    </section>`
    : crawlNotes.length
      ? `
    <section class="panel">
      <h2>사이트 연계도 <span class="sub">크롤 실패</span></h2>
      <p class="muted">페이지 1개만 발견 — 사이트 연계도를 그릴 수 없음.</p>
      ${notesHtml}
    </section>`
      : "";
  const a11yBlock = a11y
    ? `
    <section class="panel">
      <h2>접근성 실측 패키지 <span class="sub">A · KWCAG ${esc(a11y.kwcagMapVersion)}</span></h2>
      <div class="scen-grid">
        ${a11y.scenarios
          .map((s) => {
            const col = s.score >= 80 ? "#0080FF" : s.score >= 55 ? "#64748b" : "#b91c1c";
            const m = s.method === "measured" ? "실측" : s.method === "heuristic" ? "휴리스틱" : "수동권장";
            return `
          <div class="scen-card">
            <div class="scen-top">
              <span class="scen-id">${esc(s.id)}</span>
              <span class="pill ${s.method === "measured" ? "pill-m" : "pill-s"}">${m}</span>
            </div>
            <div class="scen-score" style="color:${col}">${s.score}<small>점</small></div>
            <div class="scen-label">${esc(s.label)}</div>
            <div class="scen-meta">블로커 ${s.blockers}건${s.manualHints.length ? ` · 수동 ${s.manualHints.length}` : ""}</div>
            ${s.manualHints.length ? `<div class="scen-hints">${s.manualHints.map((h) => `<div>· ${esc(h)}</div>`).join("")}</div>` : ""}
          </div>`;
          })
          .join("")}
      </div>
      <div class="a11y-stats">
        <div class="mini"><div class="muted">KWCAG 매핑</div><b>${a11y.kwcagMapped} / ${a11y.kwcagMapped + a11y.kwcagUnmapped}</b></div>
        <div class="mini"><div class="muted">미매핑</div><b style="color:${a11y.kwcagUnmapped ? "#b91c1c" : "inherit"}">${a11y.kwcagUnmapped}</b></div>
        <div class="mini"><div class="muted">대비 위반</div><b>${a11y.contrastFails}</b></div>
        ${a11y.keyboard ? `
        <div class="mini"><div class="muted">Tab 실측</div><b>${a11y.keyboard.tabsSampled}</b></div>
        <div class="mini"><div class="muted">focus 미표시</div><b style="color:${a11y.keyboard.noVisibleFocus ? "#b91c1c" : "inherit"}">${a11y.keyboard.noVisibleFocus}</b></div>
        <div class="mini"><div class="muted">트랩 의심</div><b style="color:${a11y.keyboard.trapSuspect ? "#b91c1c" : "inherit"}">${a11y.keyboard.trapSuspect ? "있음" : "없음"}</b></div>` : ""}
        ${a11y.outline ? `
        <div class="mini"><div class="muted">h1</div><b>${a11y.outline.h1}</b></div>
        <div class="mini"><div class="muted">제목 수</div><b>${a11y.outline.headings}</b></div>
        <div class="mini"><div class="muted">랜드마크</div><b>${a11y.outline.landmarks.length}</b></div>` : ""}
        ${a11y.targetSize ? `
        <div class="mini"><div class="muted">타깃<24px</div><b style="color:${a11y.targetSize.smallTargets ? "#b91c1c" : "inherit"}">${a11y.targetSize.smallTargets}</b></div>` : ""}
        ${a11y.media ? `
        <div class="mini"><div class="muted">자막 누락</div><b style="color:${a11y.media.missingCaptions ? "#b91c1c" : "inherit"}">${a11y.media.missingCaptions}</b></div>` : ""}
        ${a11y.reflow ? `
        <div class="mini"><div class="muted">200% reflow</div><b style="color:${a11y.reflow.overflow ? "#b91c1c" : "#0080FF"}">${a11y.reflow.overflow ? "가로스크롤" : "정상"}</b></div>` : ""}
      </div>
      <p class="muted" style="margin-top:10px">${esc(a11y.coverageNote)}</p>
      <p class="muted" style="margin-top:4px;font-size:10.5px">자동화는 이슈 일부만 탐지 — 스크린리더·실사용 수동 검증 필요. 인증·준수율 인용 금지.</p>
    </section>`
    : "";

  // ---- KWCAG 위반 표 ----
  const kwcagRows = a11y
    ? findings
        .filter((f) => f.domain === "kq_a" && f.kwcag)
        .slice(0, 10)
        .map(
          (f) => `
        <tr>
          <td><span class="pill ${f.kwcag?.mapped ? "pill-m" : "pill-s"}">${f.kwcag?.mapped ? esc(f.kwcag?.code || "") : "UNMAPPED"}</span></td>
          <td>${esc(f.kwcag?.title || "")}</td>
          <td>${f.kwcag?.level ? `<span class="badge sev-minor">${esc(f.kwcag.level)}</span>` : ""}</td>
          <td class="mx-total">${f.severity === "critical" ? "Crit" : f.severity === "serious" ? "Ser" : f.severity === "moderate" ? "Mod" : "Min"}</td>
          <td class="mx-total">${f.selector ? `<code>${esc(f.selector)}</code>` : ""}</td>
        </tr>`,
        )
        .join("")
    : "";
  const kwcagBlock =
    a11y && kwcagRows
      ? `
    <section class="panel">
      <h2>KWCAG 위반 <span class="sub">상위 10 · 매핑 ${a11y.kwcagMapped}/${a11y.kwcagMapped + a11y.kwcagUnmapped}</span></h2>
      <table class="cat kwcag-t">
        <thead><tr><th>KWCAG</th><th>검사항목</th><th>레벨</th><th>심각도</th><th>셀렉터</th></tr></thead>
        <tbody>${kwcagRows}</tbody>
      </table>
    </section>`
      : "";
  // ---- 구조화: ① 축×심각도 매트릭스 ② 카테고리 그룹 ③ 상세 ----
  const SEV_ORDER: FindingSeverity[] = ["critical", "serious", "moderate", "minor"];
  const sevLabel: Record<FindingSeverity, string> = {
    critical: "Crit", serious: "Ser", moderate: "Mod", minor: "Min",
  };
  const allFindings = filterFindings(job, opts?.domain);
  // ① 축×심각도 매트릭스 (모든 findings, 12개 제한 없이)
  const matrixRows = RADIUS_ORDER.map((dom) => {
    const m = KQ_META[dom];
    const domFind = allFindings.filter((f) => f.domain === dom);
    if (domFind.length === 0) return "";
    const cells = SEV_ORDER.map((sev) => {
      const n = domFind.filter((f) => f.severity === sev).length;
      const cls = n > 0 ? `mx-cell mx-${sev}` : "mx-cell mx-empty";
      return `<td class="${cls}">${n > 0 ? n : "·"}</td>`;
    }).join("");
    return `<tr><th class="mx-axis">${m.radiusLetter}</th><td class="mx-name">${esc(m.radiusName)}</td>${cells}<td class="mx-total">${domFind.length}</td></tr>`;
  }).join("");
  const matrixHtml = `
    <table class="mx">
      <thead><tr><th></th><th></th>${SEV_ORDER.map((s) => `<th class="mx-sev">${sevLabel[s]}</th>`).join("")}<th>합계</th></tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>`;
  // ② 카테고리 그룹 (위반 카테고리별 요약)
  const catMap = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const key = f.category || "기타";
    if (!catMap.has(key)) catMap.set(key, []);
    catMap.get(key)!.push(f);
  }
  const catRows = [...catMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat, fs]) => {
      const sev = fs.some((f) => f.severity === "critical") ? "critical"
        : fs.some((f) => f.severity === "serious") ? "serious"
        : fs.some((f) => f.severity === "moderate") ? "moderate" : "minor";
      const letters = [...new Set(fs.map((f) => letterOf(f.domain)))].join("");
      return `<tr>
        <td><span class="badge sev-${sev}">${sevLabel[sev]}</span> ${esc(cat)}</td>
        <td class="mx-axis">${letters}</td>
        <td class="mx-total">${fs.length}</td>
        <td class="cat-codes">${fs.slice(0, 4).map((f) => `<code>${esc(f.code)}</code>`).join(" ")}${fs.length > 4 ? ` <span class="muted">+${fs.length - 4}</span>` : ""}</td>
      </tr>`;
    })
    .join("");
  // ③ 상세 (Top 12 — 간결 카드: 코드·제목·축·권고 한 줄)
  const detailHtml = topIssues
    .map(
      (f, idx) => `
      <article class="issue">
        <div class="issue-head">
          <span class="idx">${idx + 1}</span>
          ${sevBadge(f.severity)}
          <span class="letter">${letterOf(f.domain)}</span>
          <code>${esc(f.code)}</code>
          <span class="issue-title">${esc(f.title)}</span>
          ${f.method === "measured" ? '<span class="pill pill-m">실측</span>' : ""}
        </div>
        <div class="box"><div class="lab">현상</div><p>${esc(f.description)}</p></div>
        <div class="box okb"><div class="lab">권고</div><p>${esc(f.recommendation)}</p></div>
      </article>`,
    )
    .join("");
  const topHtml = findings.length === 0
    ? `<p class="muted">위반 이슈 없음</p>`
    : `
      <div class="issue-struct">
        <h3 class="struct-h">위반 매트릭스 <span class="sub">축 × 심각도</span></h3>
        ${matrixHtml}
        <h3 class="struct-h">카테고리 요약 <span class="sub">그룹별 현황</span></h3>
        <table class="cat">
          <thead><tr><th>카테고리</th><th>축</th><th>건수</th><th>규칙 코드</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table>
        <h3 class="struct-h">상세 <span class="sub">Top ${topIssues.length} · 전체 ${findings.length}건</span></h3>
        ${detailHtml}
      </div>`;

  const roadmap = report.roadmap
    .map((r) => {
      const tone = r.id === "min" ? "min" : r.id === "standard" ? "std" : "max";
      return `
      <div class="road card-${tone}">
        <div class="road-tag">${esc(r.label)}</div>
        <p class="road-sum">${esc(r.summary)}</p>
        <div class="road-metrics">
          <div><span>기간</span><strong>${r.estimatedWeeks}주</strong></div>
          <div><span>공수</span><strong>${r.estimatedMm} MM</strong></div>
          <div><span>이슈</span><strong>${r.coversFindingIds.length}</strong></div>
        </div>
        <div class="chips">${r.focus.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
      </div>`;
    })
    .join("");

  // short exec only — no wall of 18 sections
  const honesty = report.sections.find((s) => s.id === "method-honesty");
  const execBits = report.sections
    .filter((s) => s.domain === "exec" && s.id !== "method-honesty")
    .slice(0, 2);

  const inspect = report.inspect;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RADIUS 진단 — ${esc(job.title)}</title>
<style>
  @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
  :root{
    --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f1f5f9; --card:#fff;
    --blue:#0080FF; --navy:#0b1f33; --ok:#0080FF; --crit:#b91c1c;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:"Pretendard",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);line-height:1.55;font-size:13.5px}
  .page{max-width:920px;margin:0 auto;padding:20px 16px 48px}
  .cover{background:#0b1f33;color:#fff;border-radius:16px;padding:28px 24px 22px;position:relative;overflow:hidden}
  .cover:before{content:"";position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;background:#0d2a45}
  .eyebrow{letter-spacing:.14em;font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase}
  .cover h1{margin:8px 0 6px;font-size:28px;line-height:1.25;position:relative}
  .cover .url{opacity:.9;font-size:13px;word-break:break-all;position:relative}
  .cover-grid{display:grid;grid-template-columns:1.2fr .9fr;gap:16px;margin-top:18px;position:relative}
  .glass{background:#123a5c;border:1px solid #1e4a73;border-radius:12px;padding:14px 16px}
  .glass .k{font-size:10px;opacity:.75;font-weight:700;letter-spacing:.04em}
  .glass .v{font-size:13px;font-weight:700;margin-top:3px}
  .score-wrap{display:flex;align-items:center;gap:14px}
  .grade{font-size:48px;font-weight:900;line-height:1}
  .grade small{display:block;font-size:11px;font-weight:600;opacity:.8;letter-spacing:.08em}
  .notice{margin-top:14px;background:#eef4ff;color:#1e3a8a;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;font-size:12px}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 18px}
  .toolbar a,.toolbar button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;text-decoration:none;color:var(--ink);font-size:12.5px}
  .toolbar .primary{background:var(--blue);border-color:var(--blue);color:#fff}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .panel h2{margin:0 0 12px;font-size:15px;letter-spacing:-.01em}
  .panel h2 .sub{font-weight:500;color:var(--muted);font-size:12px;margin-left:8px}
  .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
  .kpi{border:1px solid var(--line);border-radius:12px;padding:10px 8px;text-align:center;background:#fff}
  .kpi .l{font-size:10px;color:var(--muted);font-weight:700}
  .kpi .n{font-size:20px;font-weight:900;margin-top:2px;font-variant-numeric:tabular-nums}
  .axis-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .axis-card{display:flex;gap:10px;border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff}
  .axis-letter{width:44px;height:44px;border-radius:12px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex-shrink:0}
  .axis-name{font-weight:800;font-size:13px}.axis-en{font-size:10px;color:var(--muted)}
  .axis-score{font-size:26px;font-weight:900;line-height:1.1;margin:4px 0 6px}
  .axis-score small{font-size:12px;font-weight:700;margin-left:2px}
  .abar{height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden}
  .abar span{display:block;height:100%;border-radius:99px}
  .axis-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;font-size:10.5px;color:var(--muted)}
  .pill{display:inline-flex;align-items:center;border-radius:99px;padding:1px 7px;font-size:10px;font-weight:800}
  .pill-m{background:#dbeafe;color:#1e3a8a}.pill-s{background:#f1f5f9;color:#64748b}
  .split{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}
  .rbar-row{display:grid;grid-template-columns:110px 1fr 36px;gap:8px;align-items:center;margin:0 0 8px}
  .rbar-lab{font-size:11.5px}.rbar-lab b{display:inline-block;width:16px}
  .rbar-track{height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden}
  .rbar-fill{height:100%;border-radius:99px}
  .rbar-n{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
  .roads{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .road{border-radius:14px;border:1px solid var(--line);padding:12px;background:#fff}
  .card-min .road-tag{background:#fef2f2;color:#b91c1c}.card-std .road-tag{background:#eef4ff;color:#1e3a8a}.card-max .road-tag{background:#f1f5f9;color:#334155}
  .road-tag{font-weight:800;margin-bottom:6px;font-size:13px;display:inline-block;padding:2px 8px;border-radius:6px}
  .road-sum{color:#334155;font-size:12px;min-height:2.8em;margin:0 0 8px}
  .road-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#f8fafc;border-radius:10px;padding:8px;margin-bottom:8px}
  .road-metrics span{display:block;font-size:9px;color:var(--muted);font-weight:700}
  .road-metrics strong{font-size:14px}
  .chips{display:flex;flex-wrap:wrap;gap:4px}
  .chips span{background:#f1f5f9;border-radius:99px;padding:2px 8px;font-size:10.5px;font-weight:600}
  .issue{border:1px solid var(--line);border-radius:12px;padding:12px;margin:0 0 8px;background:#fff;break-inside:avoid}
  .issue-head{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px}
  .issue-title{font-weight:800;font-size:12.5px;color:var(--ink)}
  .struct-h{font-size:13px;margin:16px 0 8px;color:var(--ink)}
  .struct-h .sub{font-weight:500;color:var(--muted);font-size:11px;margin-left:6px}
  table.mx,table.cat{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:4px}
  table.mx th,table.mx td,table.cat th,table.cat td{border:1px solid var(--line);padding:5px 8px;text-align:center}
  table.mx thead th,table.cat thead th{background:#f8fafc;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.04em}
  .mx-axis{font-weight:900;color:var(--navy);width:24px}
  .mx-name{text-align:left!important;color:var(--muted);font-size:10.5px;width:110px}
  .mx-total{font-weight:900}
  .mx-cell{font-weight:800;font-size:12px}
  .mx-critical{background:#fee2e2;color:#b91c1c}
  .mx-serious{background:#ffedd5;color:#c2410c}
  .mx-moderate{background:#fef9c3;color:#a16207}
  .mx-minor{background:#f1f5f9;color:#475569}
  .mx-empty{color:#cbd5e1;background:#fff}
  table.cat td{text-align:left}
  table.cat td.mx-axis,table.cat td.mx-total{text-align:center}
  .cat-codes{display:flex;flex-wrap:wrap;gap:3px}
  .cat-codes code{font-size:9.5px}
  /* A축 실측 패키지 */
  .scen-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
  .scen-card{border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff;break-inside:avoid}
  .scen-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
  .scen-id{font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.03em}
  .scen-score{font-size:22px;font-weight:900;line-height:1.1}
  .scen-score small{font-size:10px;font-weight:700;margin-left:2px}
  .scen-label{font-size:11.5px;font-weight:700;margin-top:2px}
  .scen-meta{font-size:10px;color:var(--muted);margin-top:2px}
  .scen-hints{margin-top:6px;font-size:10px;color:#1e3a8a;background:#eef4ff;border-radius:8px;padding:5px 7px}
  .a11y-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .a11y-stats .mini{padding:6px 8px}
  .kwcag-t td{text-align:left;font-size:10.5px}
  .kwcag-t td code{font-size:9.5px}
  .smap-wrap{overflow-x:auto}
  .smap{width:100%;max-width:860px;height:auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px}
  .crawl-note{margin-top:8px;font-size:11px;color:#1e3a8a;background:#eef4ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 10px;line-height:1.6}
  @media(max-width:820px){.scen-grid{grid-template-columns:1fr 1fr}.a11y-stats{grid-template-columns:1fr 1fr}}
  .idx{width:22px;height:22px;border-radius:6px;background:var(--navy);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
  .letter{width:22px;height:22px;border-radius:6px;background:#e0f2fe;color:#0369a1;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}
  .issue h3{margin:2px 0 2px;font-size:14px}
  .badge{display:inline-block;border-radius:6px;padding:2px 7px;font-size:10.5px;font-weight:800}
  .sev-critical{background:#fee2e2;color:#b91c1c}.sev-serious{background:#ffedd5;color:#c2410c}
  .sev-moderate{background:#fef9c3;color:#a16207}.sev-minor{background:#f1f5f9;color:#475569}
  .box{background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:6px}
  .okb{background:#ecfdf5}.lab{font-size:10px;font-weight:800;color:var(--muted);margin-bottom:2px}
  .muted{color:var(--muted);font-size:11.5px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:#f1f5f9;padding:1px 5px;border-radius:4px}
  .inspect-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .mini{border:1px dashed var(--line);border-radius:10px;padding:8px 10px}
  .mini b{display:block;font-size:12px;margin-top:2px}
  .exec{font-size:12.5px;color:#334155;white-space:pre-wrap}
  footer.note{margin-top:18px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:12px}
  @media(max-width:820px){
    .cover-grid,.split,.axis-grid,.roads,.kpis,.inspect-grid{grid-template-columns:1fr 1fr}
    .kpis{grid-template-columns:repeat(3,1fr)}
  }
  @media print{
    body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .toolbar{display:none!important}
    .page{max-width:none;padding:0}
    .cover{border-radius:0;break-after:avoid}
    .panel,.axis-card,.issue,.road{break-inside:avoid}
    .no-print{display:none!important}
    a{color:inherit;text-decoration:none}
  }
</style>
</head>
<body>
<div class="page${print ? " is-print" : ""}">
  <header class="cover">
    <div class="eyebrow">${esc(BRAND.companyName)} · ${esc(BRAND.frameworkFull)} · INFOSHEET</div>
    <h1>${esc(job.title)}</h1>
    <div class="url">${esc(job.targetUrl)}</div>
    <div class="cover-grid">
      <div class="glass">
        <div class="k">REPORT</div>
        <div class="v">${esc(job.id)}</div>
        <div style="height:8px"></div>
        <div class="k">GENERATED · ENGINE</div>
        <div class="v">${esc(generated)} · ${esc(report.engine)}</div>
        <div style="height:8px"></div>
        <div class="k">RADIUS</div>
        <div class="v">${esc(BRAND.radiusExpand)}</div>
      </div>
      <div class="glass score-wrap">
        ${donutSvg(report.overallScore, 118)}
        <div>
          <div class="grade">${g}<small>GRADE</small></div>
          <div class="k" style="margin-top:6px">Crit ${crit} · Ser ${ser} · Mod ${mod} · Min ${min}</div>
          <div class="k">Pass ${report.passCount} / Fail ${report.failCount}</div>
        </div>
      </div>
    </div>
  </header>

  <div class="notice"><strong>판정 고지</strong> · ${esc(report.methodNote || BRAND.honesty)}</div>

  ${
    print
      ? ""
      : `<div class="toolbar">
    <button class="primary" onclick="window.print()">인쇄 / PDF</button>
    <a href="/api/v1/analyses/${esc(job.id)}/report?format=pdf">PDF 다운로드</a>
    <a href="/api/v1/analyses/${esc(job.id)}/report?format=xlsx">Excel</a>
    <a href="/api/v1/analyses/${esc(job.id)}/report?format=html">HTML</a>
    <a href="/dashboard/analyses/${esc(job.id)}">대시보드</a>
  </div>`
  }

  <section class="panel">
    <h2>핵심 지표 <span class="sub">KPI</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="l">종합</div><div class="n" style="color:${scoreColor(report.overallScore)}">${report.overallScore}</div></div>
      <div class="kpi"><div class="l">등급</div><div class="n">${g}</div></div>
      <div class="kpi"><div class="l">평가</div><div class="n">${report.evaluatedRuleCount}</div></div>
      <div class="kpi"><div class="l">통과</div><div class="n" style="color:var(--ok)">${report.passCount}</div></div>
      <div class="kpi"><div class="l">위반</div><div class="n" style="color:var(--crit)">${report.failCount}</div></div>
      <div class="kpi"><div class="l">P0 Crit</div><div class="n" style="color:var(--crit)">${crit}</div></div>
    </div>
  </section>

  <section class="panel">
    <h2>RADIUS 6축 <span class="sub">axis scorecards</span></h2>
    <div class="axis-grid">${axisCards}</div>
  </section>

  <div class="split">
    <section class="panel">
      <h2>축 비교 <span class="sub">bars</span></h2>
      ${radarBars}
    </section>
    <section class="panel">
      <h2>수집 메타 <span class="sub">inspect</span></h2>
      ${
        inspect
          ? `<div class="inspect-grid">
        <div class="mini"><div class="muted">mode</div><b>${esc(inspect.mode || "-")}</b></div>
        <div class="mini"><div class="muted">pages</div><b>${inspect.pagesCrawled ?? 1}</b></div>
        <div class="mini"><div class="muted">rendered</div><b>${inspect.rendered ? "yes" : "no"}</b></div>
        <div class="mini"><div class="muted">HTTP</div><b>${inspect.status}</b></div>
        <div class="mini"><div class="muted">bytes</div><b>${inspect.bytes}</b></div>
        <div class="mini"><div class="muted">ms</div><b>${inspect.elapsedMs}</b></div>
        <div class="mini"><div class="muted">axe viol</div><b>${inspect.axe?.violations ?? "-"}</b></div>
        <div class="mini"><div class="muted">hits</div><b>${inspect.hitCount}</b></div>
      </div>
      <p class="muted" style="margin:10px 0 0;word-break:break-all">${esc(inspect.finalUrl || "")}${inspect.title ? " · " + esc(inspect.title) : ""}</p>`
          : `<p class="muted">inspect 메타 없음</p>`
      }
    </section>
  </div>

  <section class="panel">
    <h2>개선 로드맵 <span class="sub">3 scenarios</span></h2>
    <div class="roads">${roadmap}</div>
  </section>

  ${a11yBlock}

  ${kwcagBlock}

  ${smBlock}

  <section class="panel">
    <h2>우선 이슈 Top ${topIssues.length} <span class="sub">전체 ${findings.length}건 · 상세는 Excel</span></h2>
    ${topHtml || "<p class=\"muted\">위반 이슈 없음</p>"}
  </section>

  ${
    honesty
      ? `<section class="panel">
    <h2>판정 방식</h2>
    <div class="exec">${esc(honesty.body)}</div>
  </section>`
      : ""
  }

  ${execBits
    .map(
      (s) => `<section class="panel">
    <h2>${esc(s.title)}</h2>
    <div class="exec">${esc(s.body.slice(0, 900))}${s.body.length > 900 ? "…" : ""}</div>
  </section>`,
    )
    .join("")}

  <footer class="note">
    ${esc(BRAND.companyName)} ${esc(BRAND.frameworkFull)} 인포그래픽 리포트 · ${esc(BRAND.productUrl)} · ${esc(BRAND.supportEmail)}
    · 생성 ${esc(report.generatedAt)} · 무단 재배포·사칭 금지
  </footer>
</div>
</body>
</html>`;
}
