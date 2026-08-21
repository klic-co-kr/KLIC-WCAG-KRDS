import { createHash } from "node:crypto";
import type {
  AnalysisJob,
  AnalysisReport,
  CategoryBreakdown,
  DomainScore,
  EvalMethod,
  Finding,
  FindingSeverity,
  RoadmapScenario,
  RuleDef,
  RuleDomain,
  RuleResult,
} from "./types";
import {
  DOMAIN_LABELS,
  DOMAIN_ORDER,
  getAllRules,
  getRuleById,
  getRulesByDomain,
} from "./rules";
import { KQ_META, optionsToAxes } from "./kq";
import { mapSeverity, severityToPriority } from "./severity-map";
import { inspectUrl, type MeasuredHit } from "./inspect";
import { newId } from "./password";
import {
  buildExecutiveSummaryText,
  buildRichSections,
  enrichFinding,
  failMessage,
  failRecommendation,
} from "./report-content";

function hashBytes(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

function severityWeight(s: FindingSeverity): number {
  switch (s) {
    case "critical":
      return 12;
    case "serious":
      return 8;
    case "moderate":
      return 4;
    case "minor":
      return 2;
  }
}

function domainsEnabled(job: AnalysisJob): RuleDomain[] {
  const axes = optionsToAxes(job.options);
  const out = DOMAIN_ORDER.filter((d) => axes[d]);
  return out.length ? out : [...DOMAIN_ORDER];
}

function resolveSeverity(rule: RuleDef): FindingSeverity {
  return (
    rule.severityDefault ||
    mapSeverity({
      domain: rule.domain,
      category: rule.category,
      subcategory: rule.subcategory,
      title: rule.title,
      tags: rule.tags,
      code: rule.code,
    })
  );
}

function evaluateSimulated(
  rule: RuleDef,
  seed: Buffer,
  index: number,
  targetUrl: string,
): RuleResult {
  const roll = (seed[index % seed.length] + index * 13) % 100;
  const finalStatus = roll < 18 + (index % 11 === 0 ? 2 : 0) ? "fail" : "pass";
  const severity = resolveSeverity(rule);
  const priority = rule.priorityDefault || severityToPriority(severity);
  return {
    ruleId: rule.id,
    code: rule.code,
    domain: rule.domain,
    category: rule.category,
    subcategory: rule.subcategory,
    title: rule.title,
    status: finalStatus,
    severity,
    priority,
    message:
      finalStatus === "fail"
        ? `[시뮬] ${failMessage(rule, targetUrl, index)}`
        : `[시뮬] 준수 가정: ${rule.title}`,
    recommendation:
      finalStatus === "fail"
        ? failRecommendation(rule)
        : "시뮬 통과 — 실측 승격 전까지 준수율로 인용 금지.",
    viewport: rule.viewport,
    scenes: rule.scenes,
  };
}

function hitToResult(h: MeasuredHit): RuleResult {
  return {
    ruleId: `meas_${h.code.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    code: h.code,
    domain: h.domain,
    category: h.category,
    subcategory: h.subcategory,
    title: h.title,
    status: h.status,
    severity: h.severity,
    priority: severityToPriority(h.severity),
    message:
      h.status === "fail"
        ? `[실측] ${h.message}${h.evidence ? ` · ${h.evidence}` : ""}`
        : h.status === "na"
          ? `[실측·해당없음] ${h.message}`
          : `[실측] ${h.message}`,
    recommendation: h.recommendation,
    scenes: ["SC-ALL"],
    kwcag: h.kwcag,
    scenarioTags: h.scenarioTags,
    evidenceKind: h.evidenceKind,
    reproducible: h.reproducible,
    selector: h.selector,
    evidence: h.evidence,
  };
}

function buildDomainScores(
  results: RuleResult[],
  methodByRuleId: Map<string, EvalMethod>,
): DomainScore[] {
  return DOMAIN_ORDER.map((domain) => {
    const rows = results.filter((r) => r.domain === domain);
    const passed = rows.filter((r) => r.status === "pass").length;
    const failed = rows.filter((r) => r.status === "fail").length;
    const na = rows.filter((r) => r.status === "na").length;
    const skipped = rows.filter((r) => r.status === "skip").length;
    const evaluated = passed + failed;
    const failPenalty = rows
      .filter((r) => r.status === "fail")
      .reduce((a, r) => a + severityWeight(r.severity), 0);
    const score =
      evaluated === 0
        ? 0
        : Math.max(
            0,
            Math.min(100, Math.round(100 - (failPenalty / Math.max(evaluated, 1)) * 8)),
          );
    const meta = KQ_META[domain];
    const measuredN = rows.filter(
      (r) => methodByRuleId.get(r.ruleId) === "measured",
    ).length;
    const method: EvalMethod =
      rows.length === 0
        ? "simulated"
        : measuredN === rows.length
          ? "measured"
          : measuredN > 0
            ? "measured"
            : "simulated";
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      axisCode: meta.axisCode,
      totalRules: rows.length,
      evaluated,
      passed,
      failed,
      skipped,
      na,
      score: evaluated ? score : 0,
      criticalFails: rows.filter(
        (r) => r.status === "fail" && r.severity === "critical",
      ).length,
      seriousFails: rows.filter(
        (r) => r.status === "fail" && r.severity === "serious",
      ).length,
      weight: meta.weight,
      method,
    };
  }).filter((d) => d.evaluated > 0 || d.na > 0 || d.totalRules > 0);
}

function weightedOverall(scores: DomainScore[]): number {
  // Prefer measured axes only for headline score
  const measured = scores.filter((s) => s.method === "measured" && s.evaluated > 0);
  const active = measured.length ? measured : scores.filter((s) => s.evaluated > 0);
  if (!active.length) return 0;
  const wsum = active.reduce((a, s) => a + s.weight, 0) || 1;
  return Math.round(active.reduce((a, s) => a + s.score * s.weight, 0) / wsum);
}

function buildCategoryBreakdown(results: RuleResult[]): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();
  for (const r of results) {
    if (r.status === "skip" || r.status === "na" || r.status === "ex") continue;
    const key = `${r.domain}::${r.category}::${r.subcategory}`;
    const cur = map.get(key) || {
      domain: r.domain,
      category: r.category,
      subcategory: r.subcategory,
      total: 0,
      passed: 0,
      failed: 0,
      score: 0,
    };
    cur.total += 1;
    if (r.status === "pass") cur.passed += 1;
    if (r.status === "fail") cur.failed += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((c) => ({
      ...c,
      score: c.total ? Math.round((c.passed / c.total) * 100) : 0,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 40);
}

function toFindings(
  results: RuleResult[],
  targetUrl: string,
  methodOf: (r: RuleResult) => EvalMethod,
): Finding[] {
  let i = 0;
  return results
    .filter((r) => r.status === "fail")
    .map((r) => {
      const base = getRuleById(r.ruleId);
      const rule: RuleDef = base ?? {
        id: r.ruleId,
        domain: r.domain,
        axisCode: KQ_META[r.domain].axisCode,
        category: r.category,
        subcategory: r.subcategory,
        code: r.code,
        title: r.title,
        description: r.message,
        severityDefault: r.severity,
        priorityDefault: r.priority,
        tags: ["measured"],
        scenes: r.scenes || ["SC-ALL"],
        source: (["kq_d", "kq_i", "kq_u"] as RuleDomain[]).includes(r.domain)
          ? "krds-mcp"
          : "klic-ext",
        viewport: "all",
      };
      const f = enrichFinding(
        {
          id: newId("fnd"),
          ruleId: r.ruleId,
          code: r.code,
          domain: r.domain,
          category: r.category,
          subcategory: r.subcategory,
          severity: r.severity,
          priority: r.priority,
          title: r.title,
          description: r.message,
          recommendation: r.recommendation,
          viewport: r.viewport,
          scenes: r.scenes || ["SC-ALL"],
          method: methodOf(r),
          kwcag: r.kwcag,
          scenarioTags: r.scenarioTags,
          evidenceKind: r.evidenceKind,
          reproducible: r.reproducible,
          selector: r.selector,
          evidence: r.evidence,
        },
        rule,
        targetUrl,
        i++,
      );
      return {
        ...f,
        method: methodOf(r),
        description: r.message,
        kwcag: r.kwcag,
        scenarioTags: r.scenarioTags,
        evidenceKind: r.evidenceKind,
        reproducible: r.reproducible,
        selector: r.selector,
        evidence: r.evidence,
      };
    });
}

function buildRoadmap(findings: Finding[]): RoadmapScenario[] {
  const crit = findings.filter((f) => f.severity === "critical");
  const ser = findings.filter((f) => f.severity === "serious");
  const mod = findings.filter((f) => f.severity === "moderate");
  const rest = findings.filter((f) => f.severity === "minor");
  const measured = findings.filter((f) => f.method === "measured");
  return [
    {
      id: "min",
      label: "최소 (실측 P0/P1)",
      summary: "서버 실측 실패(차단·긴급)만 먼저 처리.",
      estimatedWeeks: Math.max(1, Math.ceil(measured.filter((f) => f.severity === "critical" || f.severity === "serious").length / 6)),
      estimatedMm: Math.max(0.5, +(measured.length * 0.25).toFixed(1)),
      focus: ["실측 실패", "HTTPS/헤더", "alt·레이블"],
      coversFindingIds: measured.filter((f) => f.severity === "critical" || f.severity === "serious").map((f) => f.id),
    },
    {
      id: "standard",
      label: "권장 (실측 전항)",
      summary: "실측 실패 전부 + 카탈로그 보완 과제 정리.",
      estimatedWeeks: Math.max(2, Math.ceil(findings.length / 8)),
      estimatedMm: Math.max(1.5, +(findings.length * 0.3).toFixed(1)),
      focus: ["RADIUS 실측", "A/S/R", "폼·랜드마크"],
      coversFindingIds: findings.map((f) => f.id),
    },
    {
      id: "max",
      label: "최대 (카탈로그 정렬)",
      summary: "KRDS-MCP 카탈로그 전수 정렬·회귀 자동화.",
      estimatedWeeks: Math.max(4, Math.ceil((findings.length + 40) / 12)),
      estimatedMm: Math.max(3, +((crit.length + ser.length) * 0.4 + mod.length * 0.2 + rest.length * 0.1).toFixed(1)),
      focus: ["MCP 카탈로그", "axe/브라우저", "CI"],
      coversFindingIds: findings.map((f) => f.id),
    },
  ];
}

function gradeOf(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export async function evaluateJob(
  job: AnalysisJob,
  opts?: {
    onProgress?: (p: { step: string; progress: number; detail?: string }) => void;
  },
): Promise<AnalysisReport> {
  const enabled = new Set(domainsEnabled(job));
  const seed = hashBytes(`${job.id}|${job.targetUrl}|${job.createdAt}`);
  const includeSim = job.options.includeCatalogSim === true;
  const inspectMode = job.options.inspectMode || "render+axe";
  const maxPages = job.options.maxPages ?? 8;

  opts?.onProgress?.({ step: "서버 연결", progress: 20, detail: job.targetUrl });
  const inspect = await inspectUrl(job.targetUrl, {
    mode: inspectMode,
    maxPages,
    maxDepth: job.options.maxDepth,
    a11yProfile: job.options.a11yProfile,
    onProgress: (p) => {
      // 20% → 55% 구간을 페이지 크롤 진행에 따라 세분화 (자연스러운 진행률)
      const frac = maxPages > 0 ? Math.min(1, p.done / maxPages) : 1;
      const prog = Math.round(20 + frac * 35);
      opts?.onProgress?.({
        step: `페이지 크롤 ${p.done}/${maxPages}`,
        progress: prog,
        detail: p.url,
      });
    },
  });
  opts?.onProgress?.({ step: "실측 검사 완료", progress: 55, detail: `${inspect.hits.length}건 히트` });
  const results: RuleResult[] = [];
  const methodByRuleId = new Map<string, EvalMethod>();

  let ruleIdx = 0;
  for (const h of inspect.hits) {
    if (!enabled.has(h.domain)) continue;
    const r = hitToResult(h);
    results.push(r);
    methodByRuleId.set(r.ruleId, "measured");
    ruleIdx += 1;
    // 55% → 70% 구간을 히트 평가 진행에 따라 세분화
    if (ruleIdx % 5 === 0 || ruleIdx === inspect.hits.length) {
      const frac = inspect.hits.length > 0 ? ruleIdx / inspect.hits.length : 1;
      opts?.onProgress?.({
        step: "실측 결과 평가",
        progress: Math.round(55 + frac * 15),
        detail: `${ruleIdx}/${inspect.hits.length}건`,
      });
    }
  }

  if (includeSim) {
    const rules = getAllRules().filter((r) => enabled.has(r.domain));
    let idx = 0;
    const simTotal = rules.length;
    for (const r of rules) {
      const sim = evaluateSimulated(r, seed, idx++, job.targetUrl);
      results.push(sim);
      methodByRuleId.set(sim.ruleId, "simulated");
      // 70% → 80% 구간을 시뮬 평가 진행에 따라 세분화
      if (idx % 25 === 0 || idx === simTotal) {
        const frac = simTotal > 0 ? idx / simTotal : 1;
        opts?.onProgress?.({
          step: "카탈로그 시뮬 평가",
          progress: Math.round(70 + frac * 10),
          detail: `${idx}/${simTotal}규칙`,
        });
      }
    }
  }

  opts?.onProgress?.({ step: "규칙 평가", progress: 70, detail: `${results.length}건` });

  const domainScores = buildDomainScores(results, methodByRuleId).filter((d) =>
    enabled.has(d.domain),
  );
  const methodOf = (r: RuleResult): EvalMethod =>
    methodByRuleId.get(r.ruleId) || "simulated";

  const findings = toFindings(results, job.targetUrl, methodOf);
  const overall = weightedOverall(domainScores);
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const naCount = results.filter((r) => r.status === "na").length;
  const grade = gradeOf(overall);
  const roadmap = buildRoadmap(findings);
  const categoryBreakdown = buildCategoryBreakdown(results);

  const measuredAxes = DOMAIN_ORDER.filter((d) =>
    domainScores.some((s) => s.domain === d && s.method === "measured"),
  );
  const simulatedAxes = DOMAIN_ORDER.filter(
    (d) =>
      enabled.has(d) &&
      domainScores.some((s) => s.domain === d && s.method === "simulated"),
  );

  const report: AnalysisReport = {
    analysisId: job.id,
    generatedAt: new Date().toISOString(),
    engine: inspect.meta.engine || "klic-radius-inspect-v2",
    overallScore: overall,
    grade,
    summary: "",
    totalCatalogRules: getAllRules().length,
    evaluatedRuleCount: results.length,
    passCount,
    failCount,
    naCount,
    domainScores,
    categoryBreakdown,
    findings,
    roadmap,
    sections: [],
    taxonomy: "RADIUS",
    defaultMethod: "measured",
    measuredAxes,
    simulatedAxes,
    methodNote: includeSim
      ? `서버 실측(${inspectMode}, pages≤${maxPages}) + 카탈로그 시뮬. 종합점수는 실측 축 가중.`
      : `서버 실측 전용 · mode=${inspectMode} · pages≤${maxPages} · Playwright/axe${inspect.axe ? ` · axe violations ${inspect.axe.violations}` : ""}. 카탈로그 시뮬 OFF.`,
    probe: {
      url: inspect.page.url,
      fetchedAt: inspect.page.fetchedAt,
      ok: inspect.page.ok,
      status: inspect.page.status,
      error: inspect.page.error,
      headersSample: inspect.page.headers,
    },
    inspect: {
      finalUrl: inspect.page.finalUrl,
      status: inspect.page.status,
      title: inspect.page.title,
      elapsedMs: inspect.page.elapsedMs,
      bytes: inspect.page.bytes,
      error: inspect.page.error,
      hitCount: inspect.hits.length,
      pass: inspect.summary.pass,
      fail: inspect.summary.fail,
      na: inspect.summary.na,
      mode: inspect.meta.mode,
      maxPages: inspect.meta.maxPages,
      rendered: Boolean(inspect.page.rendered),
      pagesCrawled: inspect.pages.length,
      axe: inspect.axe,
      a11y: inspect.a11y
        ? {
            ...inspect.a11y,
            keyboard: inspect.a11y.keyboard ?? undefined,
            outline: inspect.a11y.outline ?? undefined,
            targetSize: inspect.a11y.targetSize ?? undefined,
            media: inspect.a11y.media ?? undefined,
            reflow: inspect.a11y.reflow ?? undefined,
          }
        : undefined,
      sitemap: inspect.sitemap,
      crawlErrors: inspect.crawlErrors.slice(0, 10),
    },
  };

  report.summary = buildExecutiveSummaryText(job, report);
  opts?.onProgress?.({ step: "리포트 구성", progress: 85, detail: "섹션·로드맵" });
  report.sections = buildRichSections({
    job,
    domainScores: report.domainScores,
    findings: report.findings,
    overall: report.overallScore,
    categoryBreakdown: report.categoryBreakdown,
    roadmap: report.roadmap,
  });
  report.sections = [
    {
      id: "method-honesty",
      number: 0,
      title: "판정 방식 고지 (필수)",
      domain: "exec",
      body: [
        report.methodNote,
        `엔진: ${report.engine} · Aditus 참고 · mode=${inspect.meta.mode}`,
        `Fetch: HTTP ${inspect.page.status || "err"} · ${inspect.page.elapsedMs}ms · ${inspect.page.bytes}B · rendered=${Boolean(inspect.page.rendered)} · ${inspect.page.finalUrl}`,
        inspect.page.title ? `title: ${inspect.page.title}` : "",
        inspect.page.error ? `error: ${inspect.page.error}` : "",
        `크롤: ${inspect.pages.length}p · errors ${inspect.crawlErrors.length}${inspect.crawlNotes?.length ? ` · 크롤 제한: ${inspect.crawlNotes.length}건 사유` : ""}`,
        inspect.axe
          ? `axe: pages ${inspect.axe.pages} · violations ${inspect.axe.violations} · passes ${inspect.axe.passes}`
          : "axe: off",
        `실측 히트: pass ${inspect.summary.pass} / fail ${inspect.summary.fail} / na ${inspect.summary.na}`,
        `실측 축: ${measuredAxes.map((d) => KQ_META[d].radiusLetter).join("") || "(없음)"}`,
        simulatedAxes.length
          ? `시뮬 축: ${simulatedAxes.map((d) => KQ_META[d].radiusLetter).join("")}`
          : "시뮬 축: 없음(기본)",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...report.sections.map((s, i) => ({ ...s, number: i + 1 })),
  ];
  opts?.onProgress?.({ step: "리포트 구성 완료", progress: 92, detail: "섹션·로드맵" });
  report.summary = buildExecutiveSummaryText(job, report);
  opts?.onProgress?.({ step: "요약·메타 정리", progress: 96, detail: "경영진 요약" });
  return report;
}

export function progressTick(job: AnalysisJob): AnalysisJob {
  if (job.status !== "running") return job;
  const next = Math.min(92, job.progress + 18 + (job.progress % 5));
  return { ...job, progress: next, updatedAt: new Date().toISOString() };
}

/** Async runner used by analyses.createAnalysis */
export async function runAnalysisJob(
  id: string,
  mutate: (fn: (job: AnalysisJob) => void) => void,
): Promise<void> {
  const { pushAnalysisEvent, analysisProgress } = requireProgressHooks();
  mutate((job) => {
    if (job.id !== id) return;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.progress = 5;
    job.updatedAt = new Date().toISOString();
  });
  pushAnalysisEvent(id, "job.running", {
    progress: 5,
    message: "분석 시작 — 대상 URL 접속 준비",
  });

  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 200));
    mutate((job) => {
      if (job.id !== id || job.status === "cancelled") return;
      Object.assign(job, progressTick(job));
    });
    analysisProgress(id, "작업 초기화", 5 + (i + 1) * 3);
  }

  let snapshot: AnalysisJob | null = null;
  mutate((job) => {
    if (job.id === id) snapshot = { ...job };
  });
  if (!snapshot || (snapshot as AnalysisJob).status === "cancelled") return;

  try {
    const report = await evaluateJob(snapshot as AnalysisJob, {
      onProgress: (p) => {
        mutate((job) => {
          if (job.id !== id || job.status === "cancelled") return;
          job.progress = p.progress;
          job.updatedAt = new Date().toISOString();
        });
        analysisProgress(id, p.step, p.progress, p.detail);
      },
    });
    mutate((job) => {
      if (job.id !== id || job.status === "cancelled") return;
      job.status = "completed";
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      job.report = report;
    });
    pushAnalysisEvent(id, "job.completed", {
      progress: 100,
      message: "분석 완료 — 리포트 생성됨",
      data: { overallScore: report.overallScore, grade: report.grade },
    });
  } catch (e) {
    mutate((job) => {
      if (job.id !== id) return;
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
      job.updatedAt = new Date().toISOString();
    });
    pushAnalysisEvent(id, "job.failed", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

function requireProgressHooks() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { pushAnalysisEvent, analysisProgress } = require("./events") as {
    pushAnalysisEvent: (
      jobId: string,
      type: string,
      opts?: { progress?: number; message?: string; data?: Record<string, unknown> },
    ) => void;
    analysisProgress: (jobId: string, step: string, progress: number, detail?: string) => void;
  };
  return { pushAnalysisEvent, analysisProgress };
}

export { getAllRules, getCatalogSummary } from "./rules";
