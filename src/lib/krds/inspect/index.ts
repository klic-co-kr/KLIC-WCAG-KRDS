/** RADIUS inspect engine — static + Playwright + axe + shallow crawl */

import type { FetchedPage } from "./fetch-page";
import { fetchPage } from "./fetch-page";
import { fetchPageRendered, withPage, closeInspectBrowser } from "./browser-fetch";
import { runAllChecks, type MeasuredHit } from "./checks";
import { axeToHits, runAxeOnPage, type AxeRunResult } from "./axe-bridge";
import { crawlSite, type CrawledPage } from "./crawl";
import type { RuleDomain } from "../types";
import { probeKeyboard, keyboardToHits, type KeyboardProbeResult } from "./a11y/keyboard";
import { probeOutline, outlineToHits, type OutlineResult } from "./a11y/outline-tree";
import { extractContrast, contrastToHits, type ContrastResult } from "./a11y/contrast";
import { probeTargetSize, probeMedia, targetToHits, mediaToHits, type TargetSizeResult, type MediaResult } from "./a11y/target-media";
import { probeReflow, reflowToHits, type ReflowResult } from "./a11y/reflow";
import { aggregateA11y, type A11yAggregate } from "./a11y/aggregate";

export type InspectMode = "static" | "render" | "render+axe";

export type InspectA11yOptions = {
  enabled?: boolean;          // default true when mode includes axe
  keyboard?: boolean;         // default true
  contrastPanel?: boolean;    // default true
  outline?: boolean;          // default true
  targetSize?: boolean;       // default true
  media?: boolean;            // default true
  reflow?: boolean;           // default false (cost) → opt-in
  scenarios?: boolean;        // default true
  maxTabs?: number;           // default 40
};

export type InspectOptions = {
  mode?: InspectMode;
  maxPages?: number;
  maxDepth?: number;
  maxAxeViolations?: number;
  timeoutMs?: number;
  a11yProfile?: InspectA11yOptions;
  /** 페이지별 진행 콜백 — SSE 진행률 자연스럽게 */
  onProgress?: (p: { done: number; total: number; url: string }) => void;
};

export type InspectResult = {
  page: FetchedPage & { rendered?: boolean; mode?: string };
  pages: CrawledPage[];
  hits: MeasuredHit[];
  measuredAxes: RuleDomain[];
  axe?: {
    pages: number;
    violations: number;
    passes: number;
  };
  /** A축 실측 패키지 (a11yProfile.enabled 시) */
  a11y?: A11yAggregate;
  /** 사이트 맵 — 크롤된 페이지 계층 (depth/from 기반) */
  sitemap?: {
    nodes: Array<{
      url: string;
      label: string;
      depth: number;
      status: number;
    }>;
    edges: Array<{ from: number; to: number }>; // node index
    maxDepth: number;
  };
  crawlErrors: string[];
  /** 크롤 제한 사유 — 왜 depth가 안 갔는지 (리포트에 표시) */
  crawlNotes: string[];
  summary: {
    pass: number;
    fail: number;
    na: number;
    byDomain: Record<string, { pass: number; fail: number; na: number }>;
  };
  meta: {
    mode: InspectMode;
    maxPages: number;
    engine: string;
  };
};

function summarize(hits: MeasuredHit[]) {
  const byDomain: InspectResult["summary"]["byDomain"] = {};
  let pass = 0;
  let fail = 0;
  let na = 0;
  const axes = new Set<RuleDomain>();
  for (const h of hits) {
    axes.add(h.domain);
    const b = byDomain[h.domain] || { pass: 0, fail: 0, na: 0 };
    if (h.status === "pass") {
      b.pass += 1;
      pass += 1;
    } else if (h.status === "fail") {
      b.fail += 1;
      fail += 1;
    } else {
      b.na += 1;
      na += 1;
    }
    byDomain[h.domain] = b;
  }
  return {
    summary: { pass, fail, na, byDomain },
    measuredAxes: [...axes] as RuleDomain[],
  };
}

function prefixHits(hits: MeasuredHit[], pageLabel: string): MeasuredHit[] {
  return hits.map((h) => ({
    ...h,
    message: `[${pageLabel}] ${h.message}`,
    evidence: h.evidence ? `${pageLabel} · ${h.evidence}` : pageLabel,
  }));
}

function dedupeHits(hits: MeasuredHit[]): MeasuredHit[] {
  const seen = new Set<string>();
  const out: MeasuredHit[] = [];
  for (const h of hits) {
    const key = `${h.domain}|${h.code}|${h.status}|${h.selector || ""}|${h.message.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function shortLabel(u: string): string {
  try {
    const x = new URL(u);
    const path = x.pathname === "/" ? "/" : x.pathname.replace(/\/$/, "");
    return path.length > 40 ? `${path.slice(0, 37)}…` : path || x.host;
  } catch {
    return u.slice(0, 40);
  }
}

export async function inspectUrl(
  url: string,
  opts: InspectOptions = {},
): Promise<InspectResult> {
  const mode: InspectMode = opts.mode || "render+axe";
  const maxPages = Math.min(Math.max(opts.maxPages ?? 8, 1), 20);
  const hits: MeasuredHit[] = [];
  const crawlErrors: string[] = [];
  const crawlNotes: string[] = [];
  let axeAgg = { pages: 0, violations: 0, passes: 0 };
  const a11yCfg = {
    enabled: opts.a11yProfile?.enabled ?? true,
    keyboard: opts.a11yProfile?.keyboard ?? true,
    contrastPanel: opts.a11yProfile?.contrastPanel ?? true,
    outline: opts.a11yProfile?.outline ?? true,
    targetSize: opts.a11yProfile?.targetSize ?? true,
    media: opts.a11yProfile?.media ?? true,
    reflow: opts.a11yProfile?.reflow ?? false,
    scenarios: opts.a11yProfile?.scenarios ?? true,
    maxTabs: opts.a11yProfile?.maxTabs ?? 40,
  };
  let kbResult: KeyboardProbeResult | null = null;
  let olResult: OutlineResult | null = null;
  let contrast: ContrastResult | null = null;
  let tgtResult: TargetSizeResult | null = null;
  let medResult: MediaResult | null = null;
  let refResult: ReflowResult | null = null;

  const useRender = mode !== "static";
  const { pages, errors, notes: crawlNotesFromCrawl } = await crawlSite(url, {
    maxPages,
    maxDepth: opts.maxDepth,
    useRender,
    timeoutMs: opts.timeoutMs,
    onPage: (p) => opts.onProgress?.({ done: p.done, total: p.total, url: p.url }),
  });
  crawlErrors.push(...errors);
  crawlNotes.push(...crawlNotesFromCrawl);
  if (crawlNotes.length) crawlNotes.forEach((n) => console.log(`[crawl] ${n}`));

  // 사이트 맵 구성 — depth/from 기반 노드·엣지
  // 노드 key: 원본 URL (from과 매칭), label: 최종 URL 경로
  const smNodes: NonNullable<InspectResult["sitemap"]>["nodes"] = [];
  const smEdges: NonNullable<InspectResult["sitemap"]>["edges"] = [];
  const smIndex = new Map<string, number>();
  const maxDepthReached = Math.max(0, ...pages.map((p) => p.depth));
  for (const p of pages) {
    const label = shortLabel(p.finalUrl || p.url);
    // 해시(#) 제거 — 같은 페이지 해시 앵커 중복 노드 방지
    const cleanUrl = (p.url || p.finalUrl || "").split("#")[0];
    const key = cleanUrl;
    if (!key || smIndex.has(key)) continue;
    const idx = smNodes.length;
    smIndex.set(key, idx);
    smNodes.push({
      url: key,
      label,
      depth: p.depth,
      status: p.status ?? 0,
    });
  }
  for (const p of pages) {
    if (!p.from) continue;
    const fromIdx = smIndex.get(p.from.split("#")[0]);
    const toIdx = smIndex.get((p.url || p.finalUrl || "").split("#")[0]);
    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      smEdges.push({ from: fromIdx, to: toIdx });
    }
  }
  const sitemap: InspectResult["sitemap"] = {
    nodes: smNodes,
    edges: smEdges,
    maxDepth: maxDepthReached,
  };

  let primaryPage: FetchedPage & { rendered?: boolean; mode?: string };
  if (pages[0]) {
    primaryPage = {
      ...pages[0],
      rendered: pages[0].rendered,
      mode: pages[0].rendered ? "playwright" : useRender ? "static-fallback" : "static",
    };
  } else {
    const p = useRender ? await fetchPageRendered(url) : await fetchPage(url);
    primaryPage = {
      ...p,
      rendered: "rendered" in p ? Boolean((p as { rendered?: boolean }).rendered) : false,
      mode: useRender ? "playwright" : "static",
    };
    pages.push({ ...primaryPage, depth: 0, rendered: primaryPage.rendered });
  }

  for (const p of pages) {
    const label = shortLabel(p.finalUrl || p.url);
    hits.push(...prefixHits(runAllChecks(p), label));
  }

  if (mode === "render+axe") {
    for (let pi = 0; pi < pages.slice(0, maxPages).length; pi++) {
      const p = pages.slice(0, maxPages)[pi];
      const target = p.finalUrl || p.url;
      const label = shortLabel(target);
      try {
        const { result, error } = await withPage(
          target,
          async (page) => {
            const axe = await runAxeOnPage(page);
            if (a11yCfg.enabled) {
              // 키보드 probe (첫 페이지만, 비용 제어)
              if (a11yCfg.keyboard && pi === 0) {
                kbResult = await probeKeyboard(page, { maxTabs: a11yCfg.maxTabs });
              }
              // outline (첫 페이지만)
              if (a11yCfg.outline && pi === 0) {
                olResult = await probeOutline(page);
              }
              // 대비 분리 (첫 페이지 axe 기준)
              if (a11yCfg.contrastPanel && pi === 0) {
                contrast = extractContrast(axe, { maxSamples: 8 });
              }
              // 타깃 크기 (첫 페이지만)
              if (a11yCfg.targetSize && pi === 0) {
                tgtResult = await probeTargetSize(page);
              }
              // 미디어 (첫 페이지만)
              if (a11yCfg.media && pi === 0) {
                medResult = await probeMedia(page);
              }
              // 200% reflow (opt-in, 첫 페이지만)
              if (a11yCfg.reflow && pi === 0) {
                refResult = await probeReflow(page);
              }
            }
            return axe;
          },
          { timeoutMs: opts.timeoutMs },
        );
        if (error || !result) {
          crawlErrors.push(`axe ${target}: ${error || "no result"}`);
          hits.push({
            domain: "kq_a",
            code: "A-AXE-ERROR",
            title: "axe 실행 실패",
            message: `[${label}] ${error || "unknown"}`,
            recommendation: "Playwright/Chromium 및 대상 접근성을 확인하세요.",
            severity: "moderate",
            status: "fail",
            category: "웹접근성",
            subcategory: "axe-core",
          });
          continue;
        }
        const axe = result as AxeRunResult;
        axeAgg.pages += 1;
        axeAgg.violations += axe.violations.length;
        axeAgg.passes += axe.passes;
        hits.push(
          ...prefixHits(
            axeToHits(axe, {
              maxViolations: opts.maxAxeViolations ?? 25,
              pageUrl: target,
            }),
            label,
          ),
        );
        // 키보드/outline/대비 hits (첫 페이지)
        if (pi === 0) {
          if (kbResult) hits.push(...prefixHits(keyboardToHits(kbResult), label));
          if (olResult) hits.push(...prefixHits(outlineToHits(olResult), label));
          const c = contrast as ContrastResult | null;
          if (c && c.fails > 0) {
            hits.push(...prefixHits(contrastToHits(c), label));
          }
          if (tgtResult) hits.push(...prefixHits(targetToHits(tgtResult), label));
          if (medResult) hits.push(...prefixHits(mediaToHits(medResult), label));
          if (refResult) hits.push(...prefixHits(reflowToHits(refResult), label));
        }
      } catch (e) {
        crawlErrors.push(`axe ${target}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  const deduped = dedupeHits(hits);
  const { summary, measuredAxes } = summarize(deduped);

  // A축 aggregate (render+axe + enabled 시)
  const a11yAgg = mode === "render+axe" && a11yCfg.enabled
    ? aggregateA11y({
        hits: deduped,
        keyboard: kbResult,
        outline: olResult,
        contrast,
        targetSize: tgtResult,
        media: medResult,
        reflow: refResult,
      })
    : undefined;

  return {
    page: primaryPage,
    pages,
    hits: deduped,
    measuredAxes,
    axe: mode === "render+axe" ? axeAgg : undefined,
    a11y: a11yAgg,
    sitemap: pages.length > 1 ? sitemap : undefined,
    crawlErrors,
    crawlNotes,
    summary,
    meta: {
      mode,
      maxPages,
      engine: "klic-radius-inspect-v2",
    },
  };
}

export type { MeasuredHit, FetchedPage, CrawledPage };
export { fetchPage, crawlSite };
export { fetchPageRendered, closeInspectBrowser };
