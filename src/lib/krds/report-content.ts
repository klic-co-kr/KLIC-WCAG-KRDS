import type {
  AnalysisJob,
  CategoryBreakdown,
  DomainScore,
  Finding,
  FindingSeverity,
  ReportSection,
  RoadmapScenario,
  RuleDef,
  RuleDomain,
  RuleResult,
} from "./types";
import { DOMAIN_LABELS, getAllRules } from "./rules";

const SEV_KO: Record<FindingSeverity, string> = {
  critical: "치명",
  serious: "심각",
  moderate: "보통",
  minor: "경미",
};

const LOCATIONS = [
  "공통 헤더/GNB",
  "메인 비주얼(Hero)",
  "본문 콘텐츠 영역",
  "검색·필터 패널",
  "폼/신청 플로우",
  "푸터·관련사이트",
  "모달·레이어 팝업",
  "테이블·목록 뷰",
  "모바일 햄버거 메뉴",
  "로그인·본인확인",
];

function pickLoc(seed: string, i: number): string {
  let h = 0;
  for (let k = 0; k < seed.length; k++) h = (h * 31 + seed.charCodeAt(k) + i) >>> 0;
  return LOCATIONS[h % LOCATIONS.length];
}

export function failMessage(rule: RuleDef, targetUrl: string, index: number): string {
  const loc = pickLoc(rule.id + targetUrl, index);
  const base = rule.description.replace(/을 확인합니다\.?$/u, "").replace(/를 확인합니다\.?$/u, "").replace(/을 검증합니다\.?$/u, "").replace(/를 검증합니다\.?$/u, "");
  switch (rule.domain) {
    case "kq_d":
      return `${loc}에서 비주얼 토큰 정렬 이슈. ${base} (D·Design · KRDS-MCP)`;
    case "kq_i":
      return `${loc}에서 UI 부품 스펙 편차. ${base} (I·Interface · KRDS-MCP)`;
    case "kq_u":
      return `${loc}에서 서비스 플로우 패턴 미흡. ${base} (U·User flow · KRDS-MCP)`;
    case "kq_a":
      return `${loc}에서 접근 보장 기준 미충족. ${base} (A·Accessibility · KLIC 확장)`;
    case "kq_s":
      return `보안 표면에서 통제 미흡. ${base} (S·Security · KLIC 확장)`;
    case "kq_r":
      return `${rule.viewport ?? "다"} 뷰포트(${loc}) 반응형 이슈. ${base} (R·Responsive · KLIC 확장)`;
  }
}

export function failRecommendation(rule: RuleDef): string {
  switch (rule.domain) {
    case "kq_d":
      return `KRDS-MCP 토큰·원칙「${rule.subcategory}」값으로 교체하고 테마 변수 일관성을 맞추세요. (${rule.code})`;
    case "kq_i":
      return `KRDS-MCP 컴포넌트「${rule.subcategory}」구조·상태·접근성 스펙을 적용하세요. (${rule.code})`;
    case "kq_u":
      return `KRDS 패턴「${rule.subcategory}」흐름·오류 처리를 서비스 장면에 맞게 보완하세요. (${rule.code})`;
    case "kq_a":
      return `KWCAG 기준「${rule.subcategory}」마크업·ARIA·대비를 수정 후 키보드/스크린리더로 확인하세요. (${rule.code})`;
    case "kq_s":
      return `보안 헤더·세션·입력 검증을 패치하고 스테이징 재스캔하세요. (${rule.code})`;
    case "kq_r":
      return `${rule.viewport ?? "all"} 브레이크포인트에서 그리드·터치 44px·가로 스크롤을 정리하세요. (${rule.code})`;
  }
}

export function enrichFinding(
  base: Finding,
  rule: RuleDef,
  targetUrl: string,
  index: number,
): Finding {
  return {
    ...base,
    description: base.description || failMessage(rule, targetUrl, index),
    recommendation: base.recommendation || failRecommendation(rule),
    priority: base.priority || rule.priorityDefault,
    scenes: base.scenes || rule.scenes || ["SC-ALL"],
  };
}

function topFindings(findings: Finding[], n: number, domain?: RuleDomain) {
  const list = domain ? findings.filter((f) => f.domain === domain) : findings;
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  return list
    .slice()
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, n);
}

function bullets(items: string[]): string {
  return items.map((x) => `• ${x}`).join("\n");
}

function domainBlock(d: DomainScore | undefined, label: string): string {
  if (!d) return `${label} 도메인은 이번 분석에서 제외되었습니다.`;
  const grade =
    d.score >= 90 ? "우수" : d.score >= 80 ? "양호" : d.score >= 70 ? "보통" : "미흡";
  return [
    `${label} 준수 점수 ${d.score}점(${grade}).`,
    `평가 규칙 ${d.evaluated}개 중 통과 ${d.passed} · 위반 ${d.failed}.`,
    `우선 조치 대상: Critical ${d.criticalFails} · Serious ${d.seriousFails}.`,
    d.failed === 0
      ? "해당 도메인에서 위반이 없어 현 수준 유지 및 회귀 방지 모니터링을 권장합니다."
      : "위반 항목은 하단 상세 표와 이슈 목록의 권고안을 기준으로 스프린트 백로그에 편성하세요.",
  ].join(" ");
}

function categoryNarrative(
  breakdown: CategoryBreakdown[],
  domain: RuleDomain,
  limit = 8,
): string {
  const rows = breakdown.filter((c) => c.domain === domain && c.failed > 0).slice(0, limit);
  if (!rows.length) return "위반이 집계된 하위 카테고리가 없습니다.";
  return rows
    .map(
      (c) =>
        `· ${c.category} / ${c.subcategory}: 점수 ${c.score}점 (통과 ${c.passed}/전체 ${c.total}, 위반 ${c.failed})`,
    )
    .join("\n");
}

function issueLines(findings: Finding[], n = 5): string {
  return topFindings(findings, n)
    .map(
      (f, i) =>
        `${i + 1}) [${SEV_KO[f.severity]}] ${f.code} ${f.title}\n   - 현상: ${f.description}\n   - 조치: ${f.recommendation}`,
    )
    .join("\n");
}

export function buildRichSections(input: {
  job: AnalysisJob;
  domainScores: DomainScore[];
  findings: Finding[];
  overall: number;
  categoryBreakdown: CategoryBreakdown[];
  roadmap: RoadmapScenario[];
}): ReportSection[] {
  const { job, domainScores, findings, overall, categoryBreakdown, roadmap } = input;
  const by = (d: RuleDomain) => domainScores.find((x) => x.domain === d);
  const crit = findings.filter((f) => f.severity === "critical").length;
  const ser = findings.filter((f) => f.severity === "serious").length;
  const mod = findings.filter((f) => f.severity === "moderate").length;
  const min = findings.filter((f) => f.severity === "minor").length;
  const host = (() => {
    try {
      return new URL(job.targetUrl).hostname;
    } catch {
      return job.targetUrl;
    }
  })();
  const grade =
    overall >= 90 ? "A(우수)" : overall >= 80 ? "B(양호)" : overall >= 70 ? "C(보통)" : "D(미흡)";
  const minR = roadmap.find((r) => r.id === "min");
  const stdR = roadmap.find((r) => r.id === "standard");
  const maxR = roadmap.find((r) => r.id === "max");

  return [
    {
      id: "cover",
      number: 1,
      title: "표지 · 분석 개요",
      domain: "exec",
      body: [
        `문서명: ${host} KLIC RADIUS 진단 리포트`,
        `대상 URL: ${job.targetUrl}`,
        `분석 ID: ${job.id}`,
        `의뢰/실행: KLIC RADIUS Engine (${job.completedAt ?? job.updatedAt})`,
        `평가 체계: RADIUS (D/I/U=KRDS-MCP · R/A/S=KLIC 확장) · KRDS ${job.options.includeKrds !== false ? "ON" : "OFF"} · A11y ${job.options.includeKwcag !== false ? "ON" : "OFF"} · Sec ${job.options.includeSecurity !== false ? "ON" : "OFF"} · RWD ${job.options.includeResponsive !== false ? "ON" : "OFF"}`,
        `종합 등급: ${grade} / ${overall}점`,
        `본 리포트는 공공 웹 품질 개선을 위한 실행 가능한 진단·로드맵 문서입니다. 임원 요약, 도메인별 상세, 우선순위 이슈, MM 산정, 재검증 절차를 포함합니다.`,
      ].join("\n"),
    },
    {
      id: "exec",
      number: 2,
      title: "경영진 요약",
      domain: "exec",
      body: [
        `1) 한 줄 결론: ${host}의 공공 웹 품질 종합 점수는 ${overall}점(${grade})입니다.`,
        `2) 핵심 리스크: Critical ${crit}건 · Serious ${ser}건이 확인되어 ${crit > 0 ? "대외 공개/검수 전 즉시 조치가 필요" : "계획적 개선으로 관리 가능"}합니다.`,
        `3) 도메인 스냅샷: ${domainScores.map((d) => `${d.label} ${d.score}점(위반 ${d.failed})`).join(" · ")}`,
        `4) 비즈니스 영향: KRDS 미준수는 공공 디자인 일관성·브랜드 신뢰에, KWCAG 미준수는 접근성 민원·법적 리스크에, 보안 이슈는 개인정보·서비스 연속성에, 반응형 이슈는 모바일 민원·이탈에 직결됩니다.`,
        `5) 권고 시나리오: 최소 ${minR?.estimatedWeeks ?? "-"}주/${minR?.estimatedMm ?? "-"}MM(Critical·Serious 중심) → 권장 ${stdR?.estimatedWeeks ?? "-"}주/${stdR?.estimatedMm ?? "-"}MM(전 이슈) → 최대 ${maxR?.estimatedWeeks ?? "-"}주/${maxR?.estimatedMm ?? "-"}MM(예방·최적화 포함).`,
        `6) 의사결정 요청: (a) 권장 시나리오 채택 여부 (b) 1차 스프린트에 Critical/Serious 고정 배치 (c) 개선 후 무상 재검증 1회 일정 확정.`,
      ].join("\n"),
    },
    {
      id: "krds-detail",
      number: 3,
      title: "D · Design 토큰 (KRDS-MCP)",
      domain: "kq_d",
      body: [
        domainBlock(by("kq_d"), "D · Design"),
        "",
        "하위 카테고리(위반 많은 순):",
        categoryNarrative(categoryBreakdown, "kq_d", 12),
        "",
        "해석: KRDS는 색·타이포·컴포넌트·패턴의 일관된 토큰 적용이 핵심입니다. 점수가 낮을수록 화면마다 다른 버튼/간격/색이 섞여 유지보수 비용이 증가합니다.",
      ].join("\n"),
    },
    {
      id: "design-style",
      number: 4,
      title: "D · Design 상세",
      domain: "kq_d",
      body: [
        "범위: 색상 시스템, 타이포그래피, 아이콘/형태, 레이아웃·그리드, 엘리베이션, 명암 대비, 링크/버튼 스타일.",
        categoryNarrative(
          categoryBreakdown.filter(
            (c) =>
              c.domain === "kq_d" &&
              (c.category.includes("색") || c.category.includes("타이포") || c.category.includes("토큰") || c.category.includes("원칙") || c.category.includes("스타일") ||
                c.category.includes("토큰") ||
                c.category.includes("원칙")),
          ),
          "kq_d",
          15,
        ),
        "",
        "주요 이슈:",
        issueLines(topFindings(findings, 5, "kq_d").filter((f) => f.category.includes("스타일") || f.category.includes("토큰") || f.subcategory.includes("색") || f.subcategory.includes("타이포")), 5) ||
          issueLines(topFindings(findings, 5, "kq_d"), 5),
      ].join("\n"),
    },
    {
      id: "components",
      number: 5,
      title: "I · Interface (KRDS-MCP)",
      domain: "kq_i",
      body: [
        "범위: KRDS-MCP 표준 컴포넌트(헤더, 버튼, 입력, 모달, 네비 등)의 구조·상태·접근성·토큰·반응형·라벨.",
        categoryNarrative(
          categoryBreakdown.filter((c) => c.domain === "kq_i" && c.category.includes("컴포넌트")),
          "kq_d",
          15,
        ),
        "",
        "우선 컴포넌트 이슈:",
        issueLines(
          findings.filter((f) => f.domain === "kq_i" && f.category.includes("컴포넌트")),
          6,
        ) || "컴포넌트 도메인 위반 없음.",
      ].join("\n"),
    },
    {
      id: "patterns",
      number: 6,
      title: "U · User flow (KRDS-MCP)",
      domain: "kq_u",
      body: [
        "범위: 글로벌 패턴(공통 UI 조립) 및 서비스 패턴(신청·조회 등 공공 플로우).",
        categoryNarrative(
          categoryBreakdown.filter((c) => c.domain === "kq_u"),
          "kq_d",
          12,
        ),
        "",
        "패턴 이슈:",
        issueLines(
          findings.filter((f) => f.domain === "kq_u"),
          5,
        ) || "패턴 도메인 위반 없음.",
      ].join("\n"),
    },
    {
      id: "kwcag",
      number: 7,
      title: "A · Accessibility (KLIC 확장)",
      domain: "kq_a",
      body: [
        domainBlock(by("kq_a"), "A · Accessibility"),
        "",
        "항목군 상세:",
        categoryNarrative(categoryBreakdown, "kq_a", 12),
        "",
        "대표 접근성 이슈:",
        issueLines(topFindings(findings, 8, "kq_a"), 8),
        "",
        "권고: 대체텍스트·명도대비·키보드/포커스·폼 라벨·ARIA를 1차 묶음으로 처리하면 체감 개선이 큽니다. AA 인증을 목표로 할 경우 권장 시나리오 이상 적용을 권고합니다.",
      ].join("\n"),
    },
    {
      id: "security",
      number: 8,
      title: "S · Security (KLIC 확장)",
      domain: "kq_s",
      body: [
        domainBlock(by("kq_s"), "S · Security"),
        "",
        "점검 축: 보안 헤더, TLS/혼합콘텐츠, 인증·세션, 주입, 접근통제, 설정 오류, 민감데이터, SSRF/리다이렉트.",
        categoryNarrative(categoryBreakdown, "kq_s", 12),
        "",
        "대표 보안 이슈:",
        issueLines(topFindings(findings, 8, "kq_s"), 8),
        "",
        "권고: Critical/Serious 보안 항목은 기능 개선보다 우선 패치하고, 변경 이력·롤백 계획을 남기세요.",
      ].join("\n"),
    },
    {
      id: "responsive",
      number: 9,
      title: "R · Responsive (KLIC 확장)",
      domain: "kq_r",
      body: [
        domainBlock(by("kq_r"), "R · Responsive"),
        "",
        "뷰포트: Mobile(≈375) · Tablet(768~1023) · Desktop(1280+) · 공통(meta/미디어).",
        categoryNarrative(categoryBreakdown, "kq_r", 12),
        "",
        "대표 반응형 이슈:",
        issueLines(topFindings(findings, 8, "kq_r"), 8),
      ].join("\n"),
    },
    {
      id: "ai-rec",
      number: 10,
      title: "AI 기반 개선 권고 (우선 Top)",
      domain: "roadmap",
      body: [
        "아래는 severity·영향도를 고려한 즉시 착수 권고 Top 이슈입니다. 각 항목은 현상·조치가 짝으로 기술됩니다.",
        "",
        issueLines(topFindings(findings, 12), 12),
        "",
        "실행 팁: 동일 서브카테고리 이슈는 한 번의 디자인 토큰/컴포넌트 수정으로 묶어 해소하면 MM이 절감됩니다.",
      ].join("\n"),
    },
    {
      id: "roadmap",
      number: 11,
      title: "개선 로드맵 (최소/권장/최대)",
      domain: "roadmap",
      body: [
        minR
          ? `【최소(경량)】 ${minR.summary}\n- 기간 ${minR.estimatedWeeks}주 · ${minR.estimatedMm} MM · 커버 이슈 ${minR.coversFindingIds.length}건\n- 포커스: ${minR.focus.join(", ")}\n- 적합한 경우: 오픈 일정 임박, Critical/Serious만 선제 차단`
          : "",
        stdR
          ? `【권장(표준)】 ${stdR.summary}\n- 기간 ${stdR.estimatedWeeks}주 · ${stdR.estimatedMm} MM · 커버 이슈 ${stdR.coversFindingIds.length}건\n- 포커스: ${stdR.focus.join(", ")}\n- 적합한 경우: 일반 공공 서비스 개편, AA 수준 목표`
          : "",
        maxR
          ? `【최대(완벽)】 ${maxR.summary}\n- 기간 ${maxR.estimatedWeeks}주 · ${maxR.estimatedMm} MM · 커버 이슈 ${maxR.coversFindingIds.length}건\n- 포커스: ${maxR.focus.join(", ")}\n- 적합한 경우: 장기 운영·인증·예방 투자`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    {
      id: "priority",
      number: 12,
      title: "우선순위 매트릭스",
      domain: "roadmap",
      body: [
        `심각도 분포: Critical ${crit} · Serious ${ser} · Moderate ${mod} · Minor ${min} (총 ${findings.length})`,
        "",
        "처리 원칙:",
        bullets([
          "P0: Critical — 배포 차단, 24~72시간 내 핫픽스",
          "P1: Serious — 다음 스프린트 필수",
          "P2: Moderate — 분기 개선 백로그",
          "P3: Minor — 여유 용량/리팩터링 시 처리",
        ]),
        "",
        "도메인×심각도:",
        ...(["kq_d", "kq_i", "kq_u", "kq_a", "kq_s", "kq_r"] as RuleDomain[]).map((d) => {
          const fs = findings.filter((f) => f.domain === d);
          return `· ${DOMAIN_LABELS[d]}: C${fs.filter((f) => f.severity === "critical").length}/S${fs.filter((f) => f.severity === "serious").length}/M${fs.filter((f) => f.severity === "moderate").length}/m${fs.filter((f) => f.severity === "minor").length}`;
        }),
      ].join("\n"),
    },
    {
      id: "mm",
      number: 13,
      title: "예상 소요 기간 및 MM",
      domain: "roadmap",
      body: [
        "산정 가정: 시니어 프론트 1 + 디자인 0.3 + QA 0.3 혼합 투입, 이슈 유형별 평균 공수 반영(데모 산식).",
        minR
          ? `최소: ${minR.estimatedWeeks}주 / ${minR.estimatedMm} MM (Critical·Serious ${minR.coversFindingIds.length}건)`
          : "",
        stdR
          ? `권장: ${stdR.estimatedWeeks}주 / ${stdR.estimatedMm} MM (전체 ${stdR.coversFindingIds.length}건)`
          : "",
        maxR
          ? `최대: ${maxR.estimatedWeeks}주 / ${maxR.estimatedMm} MM (전체+예방)`
          : "",
        "",
        "역할 가이드(권장 시나리오 기준):",
        bullets([
          "디자이너: 토큰·컴포넌트 스펙 정렬 20~30%",
          "프론트엔드: 마크업/스타일/상태 구현 50~60%",
          "접근성/QA: 검증·회귀 15~25%",
        ]),
        "주의: 실측 크롤/코드베이스 복잡도에 따라 ±30% 변동 가능. 계약 견적 전 샘플 페이지 2~3개 정밀 산정을 권장합니다.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      id: "risk",
      number: 14,
      title: "리스크 요약",
      domain: "exec",
      body: [
        crit > 0
          ? "종합 위험도: 높음 — Critical 존재. 대민 오픈/검수 전 필수 해소."
          : ser > 0
            ? "종합 위험도: 중 — Serious 중심. 일정 내 계획적 해소 필요."
            : "종합 위험도: 낮음 — 경미 이슈 위주. 지속 개선으로 충분.",
        "",
        bullets([
          `규정/가이드 리스크: D/I/U/A 위반 ${findings.filter((f) => f.domain === "kq_d" || f.domain === "kq_i" || f.domain === "kq_u" || f.domain === "kq_a").length}건`,
          `보안 리스크: S 위반 ${findings.filter((f) => f.domain === "kq_s").length}건`,
          `사용자 경험 리스크: R 위반 ${findings.filter((f) => f.domain === "kq_r").length}건`,
          "운영 리스크: 미조치 시 유사 이슈가 신규 페이지에 복제되어 기술부채 누적",
        ]),
      ].join("\n"),
    },
    {
      id: "reverify",
      number: 15,
      title: "재검증 가이드",
      domain: "exec",
      body: [
        "1. 조치 완료 이슈 목록(코드·화면 URL·담당·커밋)을 정리한다.",
        "2. 동일 대상 URL로 재분석을 실행한다(데모: 무상 재검증 1회 시나리오).",
        "3. Critical/Serious 잔여 0 및 종합 점수 목표(권장 90+) 달성 여부를 확인한다.",
        "4. 회귀 방지: 스토리북/시각 회귀/접근성 CI 훅을 파이프라인에 고정한다.",
        "5. 산출물: 본 리포트 PDF·Excel과 재검증 리포트를 쌍으로 보관한다.",
      ].join("\n"),
    },
    {
      id: "appendix-rules",
      number: 16,
      title: "부록 · 규칙 카탈로그 근거",
      domain: "appendix",
      body: [
        `전체 카탈로그 ${getAllRules().length}규칙 (KRDS-MCP 그라운딩 + KWCAG/보안/반응형 분리 팩).`,
        "규칙 열람: 제품 내 /rules 및 GET /api/v1/rules",
        "KRDS 엔티티 출처: @krds-mcp/krds-mcp (components/colors/typography/patterns/tokens)",
        "본 부록의 개별 위반 원문은 섹션 10 및 Excel ‘위반이슈’ 시트를 정본으로 한다.",
      ].join("\n"),
    },
    {
      id: "deliverables",
      number: 17,
      title: "납품 산출물 (PDF · Excel · HTML)",
      domain: "appendix",
      body: [
        "본 리포트와 함께 제공되는 산출물:",
        bullets([
          `HTML/인쇄: /dashboard/analyses/${job.id}/print`,
          `PDF: /api/v1/analyses/${job.id}/report?format=pdf`,
          `Excel(7시트): /api/v1/analyses/${job.id}/report?format=xlsx`,
          `CSV 위반목록: /api/v1/analyses/${job.id}/report?format=csv`,
        ]),
        "Excel 시트 구성: 요약 · 도메인점수 · 카테고리 · 위반이슈 · 로드맵 · 리포트섹션 · 분석옵션",
      ].join("\n"),
    },
    {
      id: "next",
      number: 18,
      title: "다음 단계 · 문의",
      domain: "exec",
      body: [
        "다음 액션 체크리스트:",
        bullets([
          "권장 로드맵 시나리오 선택 및 담당 지정",
          "P0/P1 이슈 티켓화 (코드·화면 캡처 첨부)",
          "디자인 토큰/공통 컴포넌트 수정 PR 우선",
          "재검증 일정 예약",
          "필요 시 결과 해석 미팅(30~60분) 요청",
        ]),
        "문의: 제품 내 문의 API(/api/v1/contact) 또는 담당 컨설턴트 채널.",
        `문서 종료 — ${host} / ${job.id}`,
      ].join("\n"),
    },
  ];
}

export function buildExecutiveSummaryText(
  job: AnalysisJob,
  report: {
    overallScore: number;
    findings: Finding[];
    domainScores: DomainScore[];
    passCount: number;
    failCount: number;
    evaluatedRuleCount: number;
    grade?: string;
  },
): string {
  const overall = report.overallScore;
  const findings = report.findings;
  const domainScores = report.domainScores;
  const crit = findings.filter((f) => f.severity === "critical").length;
  const ser = findings.filter((f) => f.severity === "serious").length;
  const grade =
    report.grade ||
    (overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : "D");
  return [
    `${job.targetUrl} · KLIC RADIUS 종합 ${overall}점(등급 ${grade}) [참고·시뮬포함].`,
    `규칙 ${report.evaluatedRuleCount}개 평가 · 통과 ${report.passCount} · 위반 ${report.failCount}(P0/Crit ${crit} · P1/Ser ${ser}).`,
    `축: ${domainScores.map((d) => `${d.axisCode || d.label}${d.method === "measured" ? "·실측" : "·시뮬"} ${d.score}`).join(", ")}.`,
    "methodNote" in report && (report as { methodNote?: string }).methodNote
      ? String((report as { methodNote?: string }).methodNote)
      : "S 헤더 실측 외 RADIUS 축은 시뮬 — 준수율 대외 인용 금지.",
    crit > 0
      ? "P0(차단) 이슈 있음 — 오픈/감리 전 즉시 조치."
      : "P0 없음. 실측 실패를 우선 확인.",
  ].join(" ");
}

export { SEV_KO };
