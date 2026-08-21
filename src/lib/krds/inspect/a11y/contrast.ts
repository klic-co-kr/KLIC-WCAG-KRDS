/**
 * 대비 전용 패널 — axe color-contrast 분리 집계 + 샘플
 */
import type { AxeRunResult, AxeViolation } from "../axe-bridge";
import type { MeasuredHit } from "../checks";

export interface ContrastResult {
  fails: number;
  samples: Array<{
    selector: string;
    snippet: string;
    impact: string;
  }>;
}

export function extractContrast(
  axe: AxeRunResult,
  opts: { maxSamples?: number } = {},
): ContrastResult {
  const max = opts.maxSamples ?? 8;
  const violations = axe.violations.filter(
    (v) => v.id.includes("color-contrast") || v.id === "link-in-text-block",
  );
  const samples: ContrastResult["samples"] = [];
  for (const v of violations) {
    for (const n of v.nodes ?? []) {
      if (samples.length >= max) break;
      samples.push({
        selector: n.target?.join(" ") || "",
        snippet: (n.html || n.failureSummary || "").replace(/\s+/g, " ").slice(0, 120),
        impact: v.impact || "serious",
      });
    }
    if (samples.length >= max) break;
  }
  return { fails: violations.length, samples };
}

/** 대비 → A축 hit (A-CONTRAST) */
export function contrastToHits(r: ContrastResult): MeasuredHit[] {
  if (r.fails === 0) return [];
  const kwcag = { code: "1.4.3", title: "명도 대비", level: "AA" as const, mapped: true };
  return [
    {
      domain: "kq_a",
      code: "A-CONTRAST",
      title: "명도 대비 위반",
      message: `axe color-contrast 위반 ${r.fails}건 · 샘플 ${r.samples.length}개`,
      recommendation: "텍스트와 배경의 명도 대비를 4.5:1(본문)·3:1(대형 텍스트) 이상으로 조정하세요.",
      severity: "serious",
      status: "fail",
      category: "웹접근성",
      subcategory: "대비",
      evidence: r.samples.slice(0, 3).map((s) => s.snippet).join(" | "),
      kwcag,
      scenarioTags: ["low_vision"],
      evidenceKind: "axe",
      reproducible: {
        steps: [`axe color-contrast 위반 ${r.fails}건`],
        selectors: r.samples.slice(0, 5).map((s) => s.selector).filter(Boolean),
      },
    },
  ];
}
