/**
 * 키보드 Tab 실측 probe — Playwright로 실제 Tab 시퀀스 수집
 *
 * - Tab 루프: maxTabs(기본 40)까지 Tab 누르며 activeElement 수집
 * - visible focus 휴리스틱: outline/box-shadow/배경 변화 감지
 * - trap suspect: modal role=dialog 중 focus가 modal 밖으로 나가는지
 */
import type { Page } from "playwright";
import type { MeasuredHit } from "../checks";

export interface KeyboardProbeResult {
  focusable: number;          // 전체 focusable 요소 수 (DOM 평가)
  tabsSampled: number;        // 실제 Tab 시뮬레이션 수
  focusOrder: Array<{
    tag: string;
    text: string;             // 라벨/텍스트 (최대 40자)
    selector: string;
    visibleFocus: boolean;
  }>;
  noVisibleFocus: number;     // visible focus 없는 샘플 수
  trapSuspect: boolean;       // dialog 밖으로 focus 탈출 의심
  dialogDetected: boolean;
}

export async function probeKeyboard(
  page: Page,
  opts: { maxTabs?: number } = {},
): Promise<KeyboardProbeResult> {
  const maxTabs = Math.min(Math.max(opts.maxTabs ?? 40, 1), 120);

  // 1) focusable 후보 평가 (DOM)
  const focusable = await page.evaluate(() => {
    const sel = [
      "a[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])",
      "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex=\"-1\"])",
      "iframe", "summary", "[contenteditable=true]",
    ].join(",");
    return document.querySelectorAll(sel).length;
  });

  // 2) Tab 시퀀스 실측
  const focusOrder: KeyboardProbeResult["focusOrder"] = [];
  const seen = new Set<string>();
  let noVisibleFocus = 0;
  let trapSuspect = false;
  let dialogDetected = false;

  // 초기 focus 리셋
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());

  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const tag = el.tagName.toLowerCase();
      const text = (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent || "").trim() ||
        el.getAttribute("placeholder") ||
        ""
      ).replace(/\s+/g, " ").slice(0, 40);
      // visible focus 휴리스틱: outline/box-shadow/bg 변화 or 기본 UA 표시
      const cs = getComputedStyle(el);
      const visibleFocus =
        cs.outlineStyle !== "none" && cs.outlineWidth !== "0px" &&
        cs.outlineStyle !== "" ||
        (cs.boxShadow !== "none" && cs.boxShadow !== "") ||
        cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
      // selector
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += `#${el.id}`;
      else if (el.getAttribute("name")) sel += `[name="${el.getAttribute("name")}"]`;
      else if (el.className && typeof el.className === "string") {
        sel += `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`;
      }
      // dialog 내부 여부
      const inDialog = !!el.closest("[role=dialog], dialog");
      const dialogOpen = !!document.querySelector("[role=dialog], dialog[open]");
      return { tag, text, selector: sel, visibleFocus, inDialog, dialogOpen };
    });
    if (!info) {
      // body로 돌아왔으면 루프 종료 (focus 순환)
      break;
    }
    const key = `${info.tag}|${info.selector}`;
    if (seen.has(key) && i > 3) break; // 순환 감지
    seen.add(key);
    focusOrder.push({
      tag: info.tag,
      text: info.text,
      selector: info.selector,
      visibleFocus: info.visibleFocus,
    });
    if (!info.visibleFocus) noVisibleFocus += 1;
    if (info.dialogOpen) dialogDetected = true;
    // trap suspect: dialog 열림 상태인데 focus가 dialog 밖 요소로
    if (info.dialogOpen && !info.inDialog && focusOrder.length > 1) {
      trapSuspect = true;
    }
    if (focusOrder.length >= maxTabs) break;
  }

  return {
    focusable,
    tabsSampled: focusOrder.length,
    focusOrder,
    noVisibleFocus,
    trapSuspect,
    dialogDetected,
  };
}

/** 키보드 probe → A축 MeasuredHit (A-KB-*) */
export function keyboardToHits(r: KeyboardProbeResult): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  const kw = {
    code: "2.1.1",
    title: "키보드 사용 보장",
    level: "A" as const,
    mapped: true,
  };

  // focusable 0 → NA + 설명 (SPA 빈 셸)
  if (r.focusable === 0) {
    hits.push({
      domain: "kq_a",
      code: "A-KB-NONE",
      title: "키보드 초점 요소 없음",
      message: "포커스 가능한 요소가 0개 — SPA 빈 셸 또는 렌더 실패 가능성",
      recommendation: "렌더 결과를 확인하고 콘텐츠가 로드되었는지 점검하세요.",
      severity: "moderate",
      status: "na",
      category: "웹접근성",
      subcategory: "키보드",
      kwcag: kw,
      scenarioTags: ["keyboard"],
      evidenceKind: "keyboard",
      reproducible: { steps: ["Tab 키 입력 시 초점 이동 요소 없음"] },
    });
    return hits;
  }

  // visible focus 부재
  if (r.noVisibleFocus > 0) {
    hits.push({
      domain: "kq_a",
      code: "A-KB-FOCUS",
      title: "초점 표시 미흡",
      message: `Tab 샘플 ${r.tabsSampled}개 중 ${r.noVisibleFocus}개에서 visible focus 미검출 (outline/box-shadow 없음)`,
      recommendation: "focus-visible 시 outline 또는 배경 변화를 제공하세요.",
      severity: r.noVisibleFocus >= r.tabsSampled * 0.5 ? "serious" : "moderate",
      status: "fail",
      category: "웹접근성",
      subcategory: "키보드",
      selector: r.focusOrder.find((f) => !f.visibleFocus)?.selector,
      evidence: r.focusOrder.filter((f) => !f.visibleFocus).slice(0, 5)
        .map((f) => `${f.tag} ${f.selector}`).join(", "),
      kwcag: { code: "2.4.7", title: "초점 표시", level: "AA", mapped: true },
      scenarioTags: ["keyboard"],
      evidenceKind: "keyboard",
      reproducible: {
        steps: [`Tab × ${r.tabsSampled} 이동하며 초점 표시 확인`],
        selectors: r.focusOrder.filter((f) => !f.visibleFocus).slice(0, 5)
          .map((f) => f.selector),
      },
    });
  }

  // trap suspect
  if (r.trapSuspect) {
    hits.push({
      domain: "kq_a",
      code: "A-KB-TRAP",
      title: "초점 트랩 의심",
      message: "role=dialog 열림 상태에서 Tab이 대화상자 밖 요소로 이동 — 키보드 사용자 흐름 끊김 가능",
      recommendation: "모달에서 Tab/Shift+Tab이 대화상자 내부를 순환하도록 focus trap을 구현하세요.",
      severity: "serious",
      status: "fail",
      category: "웹접근성",
      subcategory: "키보드",
      kwcag: { code: "2.1.2", title: "초점 트랩 없음", level: "A", mapped: true },
      scenarioTags: ["keyboard"],
      evidenceKind: "keyboard",
      reproducible: {
        steps: ["모달(role=dialog) 열림 상태에서 Tab 연타 — focus가 모달 밖으로 이탈하는지 확인"],
      },
    });
  }

  // Tab 시퀀스 정상 (정보성)
  if (r.tabsSampled > 0 && !r.trapSuspect) {
    hits.push({
      domain: "kq_a",
      code: "A-KB-TAB",
      title: "키보드 Tab 시퀀스 실측",
      message: `Tab ${r.tabsSampled}회 샘플링 완료 · focusable ${r.focusable} · visible focus 미검출 ${r.noVisibleFocus}`,
      recommendation: "초점 순서가 시각적 순서와 일치하는지 수동으로 확인하세요.",
      severity: "minor",
      status: r.noVisibleFocus > 0 ? "fail" : "pass",
      category: "웹접근성",
      subcategory: "키보드",
      kwcag: kw,
      scenarioTags: ["keyboard"],
      evidenceKind: "keyboard",
      reproducible: {
        steps: [`Tab × ${r.tabsSampled} — 첫 10개: ${r.focusOrder.slice(0, 10).map((f) => f.text || f.tag).join(" → ")}`],
        selectors: r.focusOrder.slice(0, 15).map((f) => f.selector),
      },
    });
  }

  return hits;
}
