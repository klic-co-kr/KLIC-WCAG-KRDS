/**
 * Outline 트리 — h1–h6 순서 + landmark 목록
 */
import type { Page } from "playwright";
import type { MeasuredHit } from "../checks";

export interface OutlineResult {
  h1: number;
  headings: Array<{ level: number; text: string }>;
  landmarks: string[];
  headingOrderIssues: string[];
  multiH1: boolean;
}

export async function probeOutline(page: Page): Promise<OutlineResult> {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: Number(h.tagName[1]),
      text: (h.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
    }));
    const landmarks = Array.from(
      document.querySelectorAll("main, nav, header, footer, [role=banner], [role=navigation], [role=main], [role=contentinfo], [role=search], [role=complementary], [role=region]"),
    )
      .map((el) => {
        const role = el.getAttribute("role");
        return role || el.tagName.toLowerCase();
      })
      .filter((v, i, a) => a.indexOf(v) === i);

    // heading 순서 이슈: 레벨 건너뜀
    const headingOrderIssues: string[] = [];
    let prev = 0;
    for (const h of headings) {
      if (prev > 0 && h.level > prev + 1) {
        headingOrderIssues.push(`h${prev} → h${h.level} 건너뜀 («${h.text}»)`);
      }
      prev = h.level;
    }
    const h1 = headings.filter((h) => h.level === 1).length;
    return {
      h1,
      headings: headings.slice(0, 40),
      landmarks,
      headingOrderIssues: headingOrderIssues.slice(0, 10),
      multiH1: h1 > 1,
    };
  });
}

/** outline → A축 hits */
export function outlineToHits(r: OutlineResult): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (r.headings.length === 0) return hits;

  if (r.multiH1) {
    hits.push({
      domain: "kq_a",
      code: "A-OUT-H1",
      title: "다중 h1",
      message: `h1 ${r.h1}개 — 문서에 h1은 1개 권장`,
      recommendation: "페이지당 h1은 1개를 권장합니다. 다중 h1은 스크린리더 사용자가 문서 구조를 파악하기 어려워지므로, 보조 제목은 h2 이하로 조정하세요.",
      severity: "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "제목 구조",
      kwcag: { code: "2.4.6", title: "제목과 레이블", level: "AA", mapped: true },
      scenarioTags: ["sr"],
      evidenceKind: "dom",
      reproducible: { steps: [`h1 ${r.h1}개 감지`] },
    });
  }
  if (r.headingOrderIssues.length > 0) {
    hits.push({
      domain: "kq_a",
      code: "A-OUT-ORDER",
      title: "제목 단계 건너뜀",
      message: r.headingOrderIssues.join(" · "),
      recommendation: "h1→h2→h3 순서로 단계를 건너뛰지 마세요.",
      severity: "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "제목 구조",
      kwcag: { code: "2.4.6", title: "제목과 레이블", level: "AA", mapped: true },
      scenarioTags: ["sr"],
      evidenceKind: "dom",
      reproducible: { steps: r.headingOrderIssues.slice(0, 3) },
    });
  }
  hits.push({
    domain: "kq_a",
    code: "A-OUT-TREE",
    title: "제목·랜드마크 구조",
    message: `h1 ${r.h1} · 제목 ${r.headings.length} · 랜드마크 ${r.landmarks.join(", ")}`,
    recommendation: "제목과 랜드마크가 콘텐츠 구조를 정확히 반영하는지 확인하세요.",
    severity: "minor",
    status: "pass",
    category: "웹접근성",
    subcategory: "제목 구조",
    evidence: r.landmarks.slice(0, 8).join(", "),
    kwcag: { code: "1.3.1", title: "정보와 관계", level: "A", mapped: true },
    scenarioTags: ["sr"],
    evidenceKind: "dom",
    reproducible: { steps: [`제목 ${r.headings.length}개 · 랜드마크 ${r.landmarks.length}개`] },
  });
  return hits;
}
