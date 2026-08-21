/** KLIC RADIUS — internal keys match letters 1:1
 *
 *  R → kq_r  Responsive
 *  A → kq_a  Accessibility
 *  D → kq_d  Design
 *  I → kq_i  Interface
 *  U → kq_u  User flow
 *  S → kq_s  Security
 */

import type { KqPriority, KqScene, RuleDomain, FindingSeverity } from "./types";
import { severityToPriority as mapPri } from "./severity-map";

/** RADIUS order R→A→D→I→U→S */
export const KQ_AXES: RuleDomain[] = [
  "kq_r",
  "kq_a",
  "kq_d",
  "kq_i",
  "kq_u",
  "kq_s",
];

export const RADIUS_ORDER: RuleDomain[] = [...KQ_AXES];

export const RADIUS_WORD = "RADIUS" as const;

export const KQ_META: Record<
  RuleDomain,
  {
    axisCode: string;
    radiusLetter: string;
    label: string;
    short: string;
    radiusName: string;
    source: "krds-mcp" | "klic-ext";
    weight: number;
    description: string;
  }
> = {
  kq_r: {
    axisCode: "R",
    radiusLetter: "R",
    label: "다기기 안정",
    short: "Responsive",
    radiusName: "Responsive",
    source: "klic-ext",
    weight: 0.1,
    description: "R · Responsive — 3-Viewport 반응형 (KLIC 확장)",
  },
  kq_a: {
    axisCode: "A",
    radiusLetter: "A",
    label: "접근 보장",
    short: "Accessibility",
    radiusName: "Accessibility",
    source: "klic-ext",
    weight: 0.25,
    description: "A · Accessibility — KWCAG 접근성 (KLIC 확장)",
  },
  kq_d: {
    axisCode: "D",
    radiusLetter: "D",
    label: "디자인 토큰",
    short: "Design",
    radiusName: "Design",
    source: "krds-mcp",
    weight: 0.15,
    description: "D · Design — 색·타이포·토큰·원칙 (KRDS-MCP 공식)",
  },
  kq_i: {
    axisCode: "I",
    radiusLetter: "I",
    label: "인터페이스",
    short: "Interface",
    radiusName: "Interface",
    source: "krds-mcp",
    weight: 0.15,
    description: "I · Interface — UI 컴포넌트 정렬 (KRDS-MCP 공식)",
  },
  kq_u: {
    axisCode: "U",
    radiusLetter: "U",
    label: "사용자 흐름",
    short: "User flow",
    radiusName: "User flow",
    source: "krds-mcp",
    weight: 0.2,
    description: "U · User flow — 글로벌·서비스 패턴 (KRDS-MCP 공식)",
  },
  kq_s: {
    axisCode: "S",
    radiusLetter: "S",
    label: "보안 표면",
    short: "Security",
    radiusName: "Security",
    source: "klic-ext",
    weight: 0.15,
    description: "S · Security — 공개 웹 보안 표면 (KLIC 확장)",
  },
};

export const SCENE_META: Record<
  KqScene,
  { label: string; description: string }
> = {
  "SC-HOME": { label: "메인·공지", description: "홈, 배너, 바로가기" },
  "SC-FIND": { label: "찾기·검색", description: "통합검색, 필터, 무결과" },
  "SC-APPLY": { label: "신청·접수", description: "다단계 폼, 첨부, 본인확인" },
  "SC-AUTH": { label: "로그인·회원", description: "SSO, 인증, 세션" },
  "SC-PAY": { label: "결제·고지", description: "고지·납부(해당 시)" },
  "SC-INFO": { label: "정책·안내", description: "약관, 개인정보, 도움말" },
  "SC-OPS": { label: "장애·점검", description: "에러, 점검, 대기열" },
  "SC-ALL": { label: "전역", description: "장면 공통" },
};

export const PRIORITY_META: Record<
  KqPriority,
  { label: string; schedule: string }
> = {
  P0: { label: "차단", schedule: "오픈/감리 블로커" },
  P1: { label: "긴급", schedule: "이번 스프린트" },
  P2: { label: "계획", schedule: "다음 배포" },
  P3: { label: "관찰", schedule: "백로그" },
};

export function severityToPriority(s: FindingSeverity): KqPriority {
  return mapPri(s);
}

export function radiusLabel(domain: RuleDomain): string {
  const m = KQ_META[domain];
  return `${m.radiusLetter} · ${m.label}`;
}

export function radiusAxisCode(domain: RuleDomain): string {
  return KQ_META[domain].axisCode;
}

export function radiusLetter(domain: RuleDomain | string): string {
  if (domain in KQ_META) return KQ_META[domain as RuleDomain].radiusLetter;
  return String(domain);
}

export function radiusBadge(domain: RuleDomain | string): string {
  if (domain in KQ_META) {
    const m = KQ_META[domain as RuleDomain];
    return `${m.radiusLetter} · ${m.radiusName}`;
  }
  return String(domain);
}

/** MCP official axes (D/I/U) */
export const MCP_AXES: RuleDomain[] = ["kq_d", "kq_i", "kq_u"];

/** Map legacy include flags → axes */
export function optionsToAxes(opts: {
  includeKrds?: boolean;
  includeKwcag?: boolean;
  includeSecurity?: boolean;
  includeResponsive?: boolean;
  axes?: Partial<Record<RuleDomain, boolean>>;
}): Record<RuleDomain, boolean> {
  if (opts.axes) {
    return {
      kq_r: opts.axes.kq_r ?? true,
      kq_a: opts.axes.kq_a ?? true,
      kq_d: opts.axes.kq_d ?? true,
      kq_i: opts.axes.kq_i ?? true,
      kq_u: opts.axes.kq_u ?? true,
      kq_s: opts.axes.kq_s ?? true,
    };
  }
  const mcp = opts.includeKrds !== false;
  return {
    kq_d: mcp,
    kq_i: mcp,
    kq_u: mcp,
    kq_a: opts.includeKwcag !== false,
    kq_s: opts.includeSecurity !== false,
    kq_r: opts.includeResponsive !== false,
  };
}
