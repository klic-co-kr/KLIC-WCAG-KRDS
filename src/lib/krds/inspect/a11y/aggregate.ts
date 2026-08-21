/**
 * A축 집계 — site-level rollup (KWCAG 매핑률·대비·키보드·outline·시나리오·타깃·미디어·reflow)
 */
import type { MeasuredHit } from "../checks";
import { KWCAG_MAP_VERSION } from "./kwcag-map";
import { scoreScenarios, coverageNote, type ScenarioScore } from "./scenarios";
import type { KeyboardProbeResult } from "./keyboard";
import type { OutlineResult } from "./outline-tree";
import type { ContrastResult } from "./contrast";
import type { TargetSizeResult, MediaResult } from "./target-media";
import type { ReflowResult } from "./reflow";

export interface A11yAggregate {
  kwcagMapVersion: string;
  kwcagMapped: number;
  kwcagUnmapped: number;
  contrastFails: number;
  keyboard: {
    focusable: number;
    tabsSampled: number;
    noVisibleFocus: number;
    trapSuspect: boolean;
  } | null;
  outline: {
    h1: number;
    headings: number;
    landmarks: string[];
    orderIssues: number;
  } | null;
  targetSize: {
    smallTargets: number;
    totalClickable: number;
  } | null;
  media: {
    mediaCount: number;
    missingCaptions: number;
    autoplayUnmuted: number;
  } | null;
  reflow: {
    zoom: number;
    overflow: boolean;
    ratio: number;
  } | null;
  scenarios: ScenarioScore[];
  coverageNote: string;
}

export function aggregateA11y(opts: {
  hits: MeasuredHit[];
  keyboard?: KeyboardProbeResult | null;
  outline?: OutlineResult | null;
  contrast?: ContrastResult | null;
  targetSize?: TargetSizeResult | null;
  media?: MediaResult | null;
  reflow?: ReflowResult | null;
}): A11yAggregate {
  const {
    hits,
    keyboard = null,
    outline = null,
    contrast = null,
    targetSize = null,
    media = null,
    reflow = null,
  } = opts;

  // KWCAG 매핑
  const aHits = hits.filter((h) => h.domain === "kq_a");
  const kwcagMapped = aHits.filter((h) => h.kwcag?.mapped).length;
  const kwcagUnmapped = aHits.filter((h) => h.kwcag && !h.kwcag.mapped).length;

  const scenarios = scoreScenarios(hits);

  return {
    kwcagMapVersion: KWCAG_MAP_VERSION,
    kwcagMapped,
    kwcagUnmapped,
    contrastFails: contrast?.fails ?? 0,
    keyboard: keyboard
      ? {
          focusable: keyboard.focusable,
          tabsSampled: keyboard.tabsSampled,
          noVisibleFocus: keyboard.noVisibleFocus,
          trapSuspect: keyboard.trapSuspect,
        }
      : null,
    outline: outline
      ? {
          h1: outline.h1,
          headings: outline.headings.length,
          landmarks: outline.landmarks,
          orderIssues: outline.headingOrderIssues.length,
        }
      : null,
    targetSize: targetSize
      ? {
          smallTargets: targetSize.smallTargets.length,
          totalClickable: targetSize.totalClickable,
        }
      : null,
    media: media
      ? {
          mediaCount: media.mediaCount,
          missingCaptions: media.missingCaptions,
          autoplayUnmuted: media.autoplayUnmuted,
        }
      : null,
    reflow: reflow
      ? {
          zoom: reflow.zoom,
          overflow: reflow.overflow,
          ratio: reflow.overflowRatio,
        }
      : null,
    scenarios,
    coverageNote: coverageNote(hits, kwcagUnmapped),
  };
}
