/**
 * 200% 확대 reflow probe — P6 (기본 off, opt-in)
 *
 * CSS zoom 200% 시뮬레이션 후 document 가로 스크롤 감지:
 *   scrollWidth > clientWidth × 1.05 → reflow 실패
 * 리스크: 사이트별 레이아웃 비용·플리커 — 타임아웃·1페이지만.
 */
import type { Page } from "playwright";
import type { MeasuredHit } from "../checks";

export interface ReflowResult {
  zoom: number;
  scrollWidth: number;
  clientWidth: number;
  overflow: boolean;         // 가로 스크롤 발생
  overflowRatio: number;     // scrollWidth / clientWidth
  offenders: string[];       // 스크롤 원인 요소 샘플 (최대 5)
}

export async function probeReflow(
  page: Page,
  opts: { zoom?: number } = {},
): Promise<ReflowResult> {
  const zoom = opts.zoom ?? 2; // 200%
  return page.evaluate((z) => {
    // body에 CSS zoom 적용
    const orig = document.body.style.zoom;
    document.body.style.zoom = String(z);
    // 레이아웃 강제 flush
    void document.body.offsetHeight;

    const doc = document.documentElement;
    const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth);
    const clientWidth = doc.clientWidth;
    const ratio = clientWidth > 0 ? scrollWidth / clientWidth : 0;

    // 가로 오버플로 원인 요소 샘플
    const offenders: string[] = [];
    if (ratio > 1.05) {
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > clientWidth + 2 && r.width > 40) {
          let s = el.tagName.toLowerCase();
          if (el.id) s += `#${el.id}`;
          else if (el.className && typeof el.className === "string") {
            s += `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`;
          }
          const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
          offenders.push(`${s}${text ? ` «${text}»` : ""} (w${Math.round(r.width)})`);
          if (offenders.length >= 5) break;
        }
      }
    }

    // 원복
    if (orig === "") document.body.style.removeProperty("zoom");
    else document.body.style.zoom = orig;

    return {
      zoom: z,
      scrollWidth,
      clientWidth,
      overflow: ratio > 1.05,
      overflowRatio: Math.round(ratio * 100) / 100,
      offenders,
    };
  }, zoom);
}

export function reflowToHits(r: ReflowResult): MeasuredHit[] {
  if (!r.overflow) return [];
  return [
    {
      domain: "kq_a",
      code: "A-REF-200",
      title: "200% 확대 시 가로 스크롤",
      message: `${r.zoom * 100}% 확대 시 scrollWidth ${r.scrollWidth}px > clientWidth ${r.clientWidth}px (${r.overflowRatio}x) — 콘텐츠 잘림/가로 스크롤 발생`,
      recommendation: "200% 확대에서 세로로만 스크롤되도록 레이아웃을 반응형으로 재구성하세요. 고정 폭·overflow:hidden 요소를 점검하세요.",
      severity: "serious",
      status: "fail",
      category: "웹접근성",
      subcategory: "확대 reflow",
      evidence: r.offenders.join(" | "),
      kwcag: { code: "1.4.10", title: "재배치(reflow)", level: "AA", mapped: true },
      scenarioTags: ["low_vision"],
      evidenceKind: "geometry",
      reproducible: {
        steps: [`CSS zoom ${r.zoom * 100}% 적용 → 가로 스크롤/잘림 확인`],
        selectors: r.offenders.slice(0, 5).map((o) => o.split(" «")[0]),
      },
    },
  ];
}
