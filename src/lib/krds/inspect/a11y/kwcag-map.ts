/**
 * KWCAG ↔ axe 매핑 데이터 (수동 큐레이션 + axe tags 자동)
 *
 * KWCAG 2.2 (한국형 웹 콘텐츠 접근성 지침 2.2) 기준.
 * axe rule id → KWCAG 검사항목 코드 매핑.
 *
 * 버전: 2026.08-draft2 (보강: image-redundant-alt 등 +37규칙 → 총 117→102 유니크)
 */
export interface KwcagMapEntry {
  axeId: string;             // axe-core rule id (e.g. "color-contrast")
  kwcagCode: string;         // KWCAG 2.2 코드 (e.g. "1.4.3")
  kwcagTitle: string;        // 한글 검사항목명
  level?: "A" | "AA" | "AAA";
  scenarioTags: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
}

/** axe rule id → KWCAG 2.2 항목 (수동 큐레이션) */
export const KWCAG_AXE_MAP: KwcagMapEntry[] = [
  // ---- 인식의 용이성 (1.x) ----
  { axeId: "image-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "input-image-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "object-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "area-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "role-img-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "video-caption", kwcagCode: "1.2.2", kwcagTitle: "자막 제공", level: "A", scenarioTags: ["hearing"] },
  { axeId: "audio-caption", kwcagCode: "1.2.2", kwcagTitle: "자막 제공", level: "A", scenarioTags: ["hearing"] },
  { axeId: "video-description", kwcagCode: "1.2.3", kwcagTitle: "자막·수화·명료한 오디오 대안", level: "A", scenarioTags: ["sr", "low_vision"] },
  { axeId: "color-contrast", kwcagCode: "1.4.3", kwcagTitle: "명도 대비", level: "AA", scenarioTags: ["low_vision"] },
  { axeId: "link-in-text-block", kwcagCode: "1.4.1", kwcagTitle: "색에 무관한 인식", level: "A", scenarioTags: ["low_vision"] },
  { axeId: "select-name", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-hidden-body", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-required-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-valid-attr-value", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-valid-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-allowed-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-allowed-role", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-conditional-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-prohibited-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-required-children", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-required-parent", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-roles", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-unsupported-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "duplicate-id-aria", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "label", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "label-title-only", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "heading-order", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "p-as-heading", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "table-header-id", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "th-has-data-cells", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "td-headers-attr", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "scope-attr-valid", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "html-has-lang", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "html-lang-valid", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "html-lang-xml:lang-match", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "landmark-one-main", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "region", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "duplicate-id", kwcagCode: "4.1.1", kwcagTitle: "파싱", level: "A", scenarioTags: ["sr"] },

  // ---- 운용의 용이성 (2.x) ----
  { axeId: "frame-title", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "nested-interactive", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "tabindex", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "aria-input-field-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "aria-toggle-field-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "aria-progressbar-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "aria-meter-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "aria-command-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "aria-tooltip-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "button-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "link-name", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "accesskey", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "meta-viewport", kwcagCode: "1.4.4", kwcagTitle: "콘텐츠 확대", level: "AA", scenarioTags: ["low_vision"] },
  { axeId: "meta-viewport-large", kwcagCode: "1.4.4", kwcagTitle: "콘텐츠 확대", level: "AA", scenarioTags: ["low_vision"] },
  { axeId: "target-size", kwcagCode: "2.5.8", kwcagTitle: "포인터 타깃 크기", level: "AAA", scenarioTags: ["low_vision", "keyboard"] },
  { axeId: "scrollable-region-focusable", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "focus-order-semantics", kwcagCode: "2.4.3", kwcagTitle: "초점 이동 순서", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "skip-link", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "landmark-no-duplicate-banner", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "landmark-no-duplicate-contentinfo", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "landmark-no-duplicate-main", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "landmark-unique", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "page-has-heading-one", kwcagCode: "2.4.6", kwcagTitle: "제목과 레이블", level: "AA", scenarioTags: ["sr"] },
  { axeId: "frame-focusable-content", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard"] },
  { axeId: "form-field-multiple-labels", kwcagCode: "3.3.2", kwcagTitle: "입력 도움", level: "A", scenarioTags: ["sr", "keyboard"] },

  // ---- 이해의 용이성 (3.x) ----
  { axeId: "lang", kwcagCode: "3.1.1", kwcagTitle: "문서 언어", level: "A", scenarioTags: ["sr"] },
  { axeId: "html-xml-lang-mismatch", kwcagCode: "3.1.1", kwcagTitle: "문서 언어", level: "A", scenarioTags: ["sr"] },
  { axeId: "autocomplete-valid", kwcagCode: "3.2.5", kwcagTitle: "입력 도움", level: "AA", scenarioTags: ["keyboard", "cognitive"] },
  { axeId: "identical-links-same-purpose", kwcagCode: "2.4.4", kwcagTitle: "링크 목적", level: "A", scenarioTags: ["sr"] },
  { axeId: "link-purpose", kwcagCode: "2.4.4", kwcagTitle: "링크 목적", level: "A", scenarioTags: ["sr"] },

  // ---- 견고성 (4.x) ----
  { axeId: "aria-hidden-focus", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "empty-heading", kwcagCode: "2.4.6", kwcagTitle: "제목과 레이블", level: "AA", scenarioTags: ["sr"] },
  { axeId: "empty-button-name", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "input-button-name", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "selectmenu-name", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "listitem", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "list", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "definition-list", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "dlitem", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "marquee", kwcagCode: "2.2.2", kwcagTitle: "중단·일시정지·숨김", level: "A", scenarioTags: ["cognitive"] },
  { axeId: "meta-refresh", kwcagCode: "2.2.1", kwcagTitle: "콘텐츠 자동 변경", level: "A", scenarioTags: ["cognitive"] },
  { axeId: "meta-viewport-wide", kwcagCode: "1.4.4", kwcagTitle: "콘텐츠 확대", level: "AA", scenarioTags: ["low_vision"] },

  // ---- 보강 (2026-08) — 실제 UNMAPPED 사례 + axe-core 누락 규칙 ----
  { axeId: "image-redundant-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr"] },
  { axeId: "svg-img-alt", kwcagCode: "1.1.1", kwcagTitle: "대체 텍스트", level: "A", scenarioTags: ["sr"] },
  { axeId: "no-autoplay-audio", kwcagCode: "1.4.2", kwcagTitle: "소리 자동 재생 금지", level: "A", scenarioTags: ["hearing", "cognitive"] },
  { axeId: "color-contrast-enhanced", kwcagCode: "1.4.6", kwcagTitle: "명도 대비(향상)", level: "AAA", scenarioTags: ["low_vision"] },
  { axeId: "css-orientation-lock", kwcagCode: "1.3.4", kwcagTitle: "화면 방향 고정 금지", level: "AA", scenarioTags: ["low_vision"] },
  { axeId: "avoid-inline-spacing", kwcagCode: "1.4.12", kwcagTitle: "텍스트 간격", level: "AA", scenarioTags: ["low_vision"] },
  { axeId: "label-content-name-mismatch", kwcagCode: "2.5.3", kwcagTitle: "라벨·이름 일치", level: "A", scenarioTags: ["sr", "keyboard"] },
  { axeId: "server-side-image-map", kwcagCode: "2.1.1", kwcagTitle: "키보드 사용 보장", level: "A", scenarioTags: ["keyboard", "sr"] },
  { axeId: "frame-title-unique", kwcagCode: "2.4.1", kwcagTitle: "반복 영역 건너뛰기", level: "A", scenarioTags: ["sr"] },
  { axeId: "valid-lang", kwcagCode: "3.1.2", kwcagTitle: "부분 언어", level: "AA", scenarioTags: ["sr"] },
  { axeId: "presentation-role-conflict", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "landmark-banner-is-top-level", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "landmark-contentinfo-is-top-level", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "landmark-main-is-top-level", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "table-fake-caption", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "table-duplicate-name", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "table-tbody", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "duplicate-id-active", kwcagCode: "4.1.1", kwcagTitle: "파싱", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-busy", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-dialog-name", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-text", kwcagCode: "1.3.1", kwcagTitle: "정보와 관계", level: "A", scenarioTags: ["sr"] },
  { axeId: "aria-treeitem-name", kwcagCode: "4.1.2", kwcagTitle: "이름·역할·값", level: "A", scenarioTags: ["sr"] },
];

/** axe rule id → KWCAG 매핑 lookup */
export function lookupKwcag(axeId: string): KwcagMapEntry | undefined {
  return KWCAG_AXE_MAP.find((e) => e.axeId === axeId);
}

/** axe tags에서 KWCAG 레벨 추론 (1차 자동) */
export function kwcagLevelFromTags(tags: string[]): "A" | "AA" | "AAA" | undefined {
  if (tags.includes("wcag22aaa") || tags.includes("wcag21aaa") || tags.includes("wcag2aaa")) return "AAA";
  if (tags.includes("wcag22aa") || tags.includes("wcag21aa") || tags.includes("wcag2aa")) return "AA";
  if (tags.includes("wcag22a") || tags.includes("wcag21a") || tags.includes("wcag2a")) return "A";
  return undefined;
}

export const KWCAG_MAP_VERSION = "2026.08-draft2";
export const KWCAG_AXE_MAP_COUNT = KWCAG_AXE_MAP.length;
