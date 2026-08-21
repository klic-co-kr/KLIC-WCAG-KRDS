/**
 * 타깃 크기·미디어 probe — P4
 *
 * - 클릭 가능 요소 bounding box < 24px → fail (KWCAG 2.5.8 인접)
 * - video/audio `track[kind=captions|subtitles]` 존재 여부
 * - autoplay + muted 아닌 미디어 경고
 */
import type { Page } from "playwright";
import type { MeasuredHit } from "../checks";

export interface TargetSizeResult {
  /** 24px 미만 클릭 가능 요소 샘플 */
  smallTargets: Array<{ tag: string; text: string; selector: string; w: number; h: number }>;
  totalClickable: number;
}

export interface MediaResult {
  mediaCount: number;
  videos: Array<{ selector: string; hasCaptions: boolean; autoplay: boolean; muted: boolean }>;
  missingCaptions: number;
  autoplayUnmuted: number;
}

export async function probeTargetSize(page: Page): Promise<TargetSizeResult> {
  return page.evaluate(() => {
    const sel = [
      "a[href]", "button:not([disabled])",
      "input[type=button], input[type=submit], input[type=checkbox], input[type=radio]",
      "select:not([disabled])", "summary", "[role=button], [role=link]",
    ].join(",");
    const els = Array.from(document.querySelectorAll(sel));
    const small: TargetSizeResult["smallTargets"] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 24 && r.height < 24) {
        const text = (
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          (el.textContent || "").trim() ||
          ""
        ).replace(/\s+/g, " ").slice(0, 40);
        let s = el.tagName.toLowerCase();
        if (el.id) s += `#${el.id}`;
        else if (el.className && typeof el.className === "string") {
          s += `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`;
        }
        small.push({ tag: el.tagName.toLowerCase(), text, selector: s, w: Math.round(r.width), h: Math.round(r.height) });
        if (small.length >= 8) break;
      }
    }
    return { smallTargets: small, totalClickable: els.length };
  });
}

export async function probeMedia(page: Page): Promise<MediaResult> {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll("video, audio")).map((el) => {
      const m = el as HTMLMediaElement;
      const tracks = Array.from(m.querySelectorAll("track[kind=captions], track[kind=subtitles]"));
      return {
        selector: `${m.tagName.toLowerCase()}${m.id ? `#${m.id}` : ""}`,
        hasCaptions: tracks.length > 0,
        autoplay: m.hasAttribute("autoplay"),
        muted: m.muted || m.hasAttribute("muted"),
      };
    });
    return {
      mediaCount: videos.length,
      videos: videos.slice(0, 10),
      missingCaptions: videos.filter((v) => !v.hasCaptions).length,
      autoplayUnmuted: videos.filter((v) => v.autoplay && !v.muted).length,
    };
  });
}

export function targetToHits(r: TargetSizeResult): MeasuredHit[] {
  if (r.smallTargets.length === 0) return [];
  return [
    {
      domain: "kq_a",
      code: "A-TGT-SIZE",
      title: "포인터 타깃 크기 미달",
      message: `클릭 가능 요소 ${r.totalClickable}개 중 ${r.smallTargets.length}개가 24×24px 미만 — 모바일·저시력 사용자 조작 어려움`,
      recommendation: "터치 타깃을 24×24px 이상(권장 44×44px)으로 확보하고, 인접 타깃과 간격을 두세요.",
      severity: "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "타깃 크기",
      evidence: r.smallTargets.slice(0, 4).map((t) => `${t.tag} ${t.text || t.selector} (${t.w}×${t.h})`).join(" | "),
      kwcag: { code: "2.5.8", title: "포인터 타깃 크기", level: "AAA", mapped: true },
      scenarioTags: ["low_vision", "keyboard"],
      evidenceKind: "geometry",
      reproducible: {
        steps: ["클릭 가능 요소 bounding box 측정 — 24×24px 미만 샘플 수집"],
        selectors: r.smallTargets.slice(0, 5).map((t) => t.selector),
      },
    },
  ];
}

export function mediaToHits(r: MediaResult): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (r.mediaCount === 0) return hits;
  if (r.missingCaptions > 0) {
    hits.push({
      domain: "kq_a",
      code: "A-MED-CAPTION",
      title: "미디어 자막 누락",
      message: `미디어 ${r.mediaCount}개 중 ${r.missingCaptions}개에 captions/subtitles track 없음`,
      recommendation: "video/audio에 track[kind=captions]을 제공하여 청각 장애인에게 대안을 제공하세요.",
      severity: r.missingCaptions === r.mediaCount ? "serious" : "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "미디어",
      kwcag: { code: "1.2.2", title: "자막 제공", level: "A", mapped: true },
      scenarioTags: ["hearing"],
      evidenceKind: "dom",
      reproducible: { steps: [`미디어 ${r.mediaCount}개 확인 — 자막 track 유무`] },
    });
  }
  if (r.autoplayUnmuted > 0) {
    hits.push({
      domain: "kq_a",
      code: "A-MED-AUTOPLAY",
      title: "자동재생 음성 미디어",
      message: `autoplay + muted 아님 미디어 ${r.autoplayUnmuted}개 — 사용자 통제 없이 소리 재생`,
      recommendation: "autoplay는 muted로만 허용하고, 소리 재생은 사용자 시작 시에만 하세요.",
      severity: "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "미디어",
      kwcag: { code: "1.4.2", title: "소리 자동 재생 금지", level: "A", mapped: true },
      scenarioTags: ["hearing", "cognitive"],
      evidenceKind: "dom",
      reproducible: { steps: ["autoplay 속성 + muted 상태 확인"] },
    });
  }
  return hits;
}
