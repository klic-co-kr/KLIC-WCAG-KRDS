/** Severity / priority mapping — content-based, not index modulo */

import type { FindingSeverity, KqPriority, RuleDomain } from "./types";

export function severityToPriority(s: FindingSeverity): KqPriority {
  if (s === "critical") return "P0";
  if (s === "serious") return "P1";
  if (s === "moderate") return "P2";
  return "P3";
}

type Hint = {
  severity: FindingSeverity;
  match: (ctx: {
    domain: RuleDomain;
    category: string;
    subcategory: string;
    title: string;
    tags: string[];
    code: string;
  }) => boolean;
};

const Hints: Hint[] = [
  // KQ-S high
  {
    severity: "critical",
    match: ({ domain, title, tags, code }) =>
      domain === "kq_s" &&
      /주입|injection|xss|sqli|rce|인증우회|권한상승|ssrf/i.test(
        `${title} ${tags.join(" ")} ${code}`,
      ),
  },
  {
    severity: "critical",
    match: ({ domain, title }) =>
      domain === "kq_s" && /세션고정|세션 탈취|비밀번호 평문/i.test(title),
  },
  {
    severity: "serious",
    match: ({ domain, title, code }) =>
      domain === "kq_s" &&
      /csp|hsts|x-frame|x-content-type|referrer-policy|permissions-policy|cors|cookie|tls|혼합.?콘텐츠/i.test(
        `${title} ${code}`,
      ),
  },
  {
    severity: "serious",
    match: ({ domain, title }) =>
      domain === "kq_s" && /권한|인가|access.?control|csrf/i.test(title),
  },
  // KQ-A high
  {
    severity: "critical",
    match: ({ domain, title }) =>
      domain === "kq_a" && /대체.?텍스트|키보드|초점|포커스.?trap|명도.?대비/i.test(title),
  },
  {
    severity: "serious",
    match: ({ domain, title, subcategory }) =>
      domain === "kq_a" &&
      /aria|레이블|label|오류.?안내|캡션|자막|skip/i.test(`${title} ${subcategory}`),
  },
  // U User flow
  {
    severity: "serious",
    match: ({ domain, title }) =>
      domain === "kq_u" && /오류|예외|흐름 완결|중단|재시도/i.test(title),
  },
  {
    severity: "moderate",
    match: ({ domain }) => domain === "kq_u",
  },
  // I Interface
  {
    severity: "serious",
    match: ({ domain, title, tags }) =>
      domain === "kq_i" &&
      (title.includes("접근성") || tags.includes("접근성")),
  },
  {
    severity: "moderate",
    match: ({ domain, title }) =>
      domain === "kq_i" && title.includes("상태"),
  },
  {
    severity: "minor",
    match: ({ domain, title }) =>
      domain === "kq_i" && title.includes("구조"),
  },
  // D Design
  {
    severity: "serious",
    match: ({ domain, category, title }) =>
      domain === "kq_d" &&
      (category.includes("원칙") || /대비|contrast|고대비/i.test(title)),
  },
  {
    severity: "moderate",
    match: ({ domain, category }) =>
      domain === "kq_d" && (category.includes("색") || category.includes("타이포")),
  },
  {
    severity: "minor",
    match: ({ domain }) => domain === "kq_d",
  },
  // KQ-R
  {
    severity: "serious",
    match: ({ domain, title }) =>
      domain === "kq_r" && /가로.?스크롤|터치|viewport|겹침|잘림/i.test(title),
  },
  {
    severity: "moderate",
    match: ({ domain }) => domain === "kq_r",
  },
  // KQ-S default
  {
    severity: "moderate",
    match: ({ domain }) => domain === "kq_s",
  },
  // KQ-A default
  {
    severity: "moderate",
    match: ({ domain }) => domain === "kq_a",
  },
];

export function mapSeverity(ctx: {
  domain: RuleDomain;
  category: string;
  subcategory: string;
  title: string;
  tags?: string[];
  code?: string;
}): FindingSeverity {
  const full = {
    tags: ctx.tags || [],
    code: ctx.code || "",
    ...ctx,
  };
  for (const h of Hints) {
    if (h.match(full)) return h.severity;
  }
  return "minor";
}
