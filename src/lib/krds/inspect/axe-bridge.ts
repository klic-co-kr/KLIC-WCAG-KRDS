/** axe-core bridge — Aditus axe_bridge 대응 (Playwright Page) */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { FindingSeverity } from "../types";
import type { MeasuredHit } from "./checks";
import { lookupKwcag, kwcagLevelFromTags } from "./a11y/kwcag-map";

const require = createRequire(import.meta.url);

let axeSourceCache: string | null = null;

export function loadAxeSource(): string {
  if (axeSourceCache) return axeSourceCache;
  try {
    // axe-core package exports .source in CJS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const axe = require("axe-core") as { source?: string };
    if (axe.source) {
      axeSourceCache = axe.source;
      return axeSourceCache;
    }
  } catch {
    /* fall through */
  }
  try {
    const p = require.resolve("axe-core/axe.min.js");
    axeSourceCache = readFileSync(p, "utf8");
    return axeSourceCache;
  } catch (e) {
    throw new Error(`axe-core 로드 실패: ${e instanceof Error ? e.message : e}`);
  }
}

export type AxeViolation = {
  id: string;
  impact?: string | null;
  description: string;
  help: string;
  helpUrl?: string;
  tags: string[];
  nodes: { target: string[]; failureSummary?: string; html?: string }[];
};

export type AxeRunResult = {
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  raw?: unknown;
};

function impactToSeverity(impact?: string | null): FindingSeverity {
  switch ((impact || "").toLowerCase()) {
    case "critical":
      return "critical";
    case "serious":
      return "serious";
    case "moderate":
      return "moderate";
    default:
      return "minor";
  }
}

/** Run axe inside a Playwright page (already navigated). */
export async function runAxeOnPage(page: Page): Promise<AxeRunResult> {
  const source = loadAxeSource();
  await page.evaluate(source);
  const raw = (await page.evaluate(`(async () => {
    if (typeof axe === 'undefined') throw new Error('axe not injected');
    return await axe.run();
  })()`)) as {
    violations?: AxeViolation[];
    passes?: unknown[];
    incomplete?: unknown[];
    inapplicable?: unknown[];
  };

  return {
    violations: raw.violations || [],
    passes: raw.passes?.length ?? 0,
    incomplete: raw.incomplete?.length ?? 0,
    inapplicable: raw.inapplicable?.length ?? 0,
    raw,
  };
}

/** Map axe violations → RADIUS A-axis MeasuredHit */
export function axeToHits(
  axe: AxeRunResult,
  opts: { maxViolations?: number; pageUrl?: string } = {},
): MeasuredHit[] {
  const max = opts.maxViolations ?? 40;
  const hits: MeasuredHit[] = [];

  hits.push({
    domain: "kq_a",
    code: "A-AXE-RUN",
    title: "axe-core 실행",
    message: `violations ${axe.violations.length} · passes ${axe.passes} · incomplete ${axe.incomplete}`,
    recommendation: "axe 위반을 우선 수정하세요. WCAG/KWCAG 매핑은 tags 참고.",
    severity: axe.violations.length ? "moderate" : "minor",
    status: "pass",
    category: "웹접근성",
    subcategory: "axe-core",
    evidence: opts.pageUrl,
  });

  for (const v of axe.violations.slice(0, max)) {
    const sample = v.nodes?.[0];
    const target = sample?.target?.join(" ") || "";
    const kw = lookupKwcag(v.id);
    const level = kw?.level || kwcagLevelFromTags(v.tags || []);
    hits.push({
      domain: "kq_a",
      code: `A-AXE-${v.id}`.toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 48),
      title: `axe: ${v.id}`,
      message: `${v.help || v.description}${v.nodes?.length ? ` · 노드 ${v.nodes.length}` : ""}`,
      recommendation: v.helpUrl
        ? `${v.help} — ${v.helpUrl}`
        : v.help || "axe 규칙 문서를 참고하세요.",
      severity: impactToSeverity(v.impact),
      status: "fail",
      category: "웹접근성",
      subcategory: v.tags?.find((t) => t.startsWith("wcag")) || "axe",
      selector: target || undefined,
      evidence: textSnippet(sample?.html || sample?.failureSummary || "", 160),
      kwcag: kw
        ? {
            code: kw.kwcagCode,
            title: kw.kwcagTitle,
            level,
            mapped: true,
          }
        : {
            code: "UNMAPPED",
            title: "KWCAG 미매핑",
            level,
            mapped: false,
          },
      scenarioTags: kw?.scenarioTags ?? ["sr"],
      evidenceKind: "axe",
      reproducible: {
        steps: [`axe 규칙 ${v.id} 위반 · 노드 ${v.nodes?.length ?? 0}개`],
        selectors: sample?.target?.length ? [...sample.target] : undefined,
      },
    });
  }

  if (axe.violations.length === 0) {
    hits.push({
      domain: "kq_a",
      code: "A-AXE-CLEAN",
      title: "axe 위반 없음",
      message: "axe.run() 기준 violations 0 (렌더 DOM)",
      recommendation: "수동·키보드 점검과 KWCAG 카탈로그는 별도 유지.",
      severity: "minor",
      status: "pass",
      category: "웹접근성",
      subcategory: "axe-core",
    });
  }

  return hits;
}

function textSnippet(s: string, n: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}
