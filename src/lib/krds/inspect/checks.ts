/** RADIUS 실측 체크 — Aditus 정적 HTML + 헤더 검사 (axe 없이 서버측) */

import * as cheerio from "cheerio";
import type { FindingSeverity, RuleDomain } from "../types";
import type { FetchedPage } from "./fetch-page";

export type MeasuredHit = {
  domain: RuleDomain;
  code: string;
  title: string;
  message: string;
  recommendation: string;
  severity: FindingSeverity;
  selector?: string;
  evidence?: string;
  status: "pass" | "fail" | "na";
  category: string;
  subcategory: string;
  /** KWCAG 2.2 매핑 (axe 위반 시) */
  kwcag?: {
    code: string;          // e.g. "1.1.1"
    title: string;         // 한글 검사항목명
    level?: "A" | "AA" | "AAA";
    mapped: boolean;       // false → UNMAPPED
  };
  /** 사용자 시나리오 태그 */
  scenarioTags?: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
  /** 증거 종류 */
  evidenceKind?: "dom" | "axe" | "keyboard" | "geometry" | "heuristic";
  /** 재현 방법 (키보드 등) */
  reproducible?: {
    steps: string[];
    selectors?: string[];
  };
};

function hdr(page: FetchedPage, name: string): string {
  return page.headers[name.toLowerCase()] || "";
}

function textSnippet(s: string, n = 120): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

/** S — 보안 헤더·전송 */
export function checkSecurity(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  const https = page.finalUrl.startsWith("https://");
  hits.push({
    domain: "kq_s",
    code: "S-MEAS-HTTPS",
    title: "HTTPS 전송",
    message: https
      ? "최종 URL이 HTTPS입니다."
      : "최종 URL이 HTTPS가 아닙니다.",
    recommendation: "전 구간 TLS(HTTPS)를 강제하고 HSTS를 설정하세요.",
    severity: "critical",
    status: https ? "pass" : "fail",
    category: "보안 표면",
    subcategory: "전송",
    evidence: page.finalUrl,
  });

  const checks: {
    code: string;
    title: string;
    header: string;
    severity: FindingSeverity;
    test: (v: string) => boolean;
    rec: string;
  }[] = [
    {
      code: "S-MEAS-CSP",
      title: "Content-Security-Policy",
      header: "content-security-policy",
      severity: "serious",
      test: (v) => v.length > 0,
      rec: "CSP 헤더를 배포해 인라인/외부 스크립트 정책을 명시하세요.",
    },
    {
      code: "S-MEAS-HSTS",
      title: "Strict-Transport-Security",
      header: "strict-transport-security",
      severity: "serious",
      test: (v) => /max-age=\d+/i.test(v) && https,
      rec: "HSTS max-age를 설정하세요(HTTPS 전제).",
    },
    {
      code: "S-MEAS-XFO",
      title: "X-Frame-Options 또는 frame-ancestors",
      header: "x-frame-options",
      severity: "serious",
      test: (v) =>
        !!v || /frame-ancestors/i.test(hdr(page, "content-security-policy")),
      rec: "클릭재킹 방지를 위해 X-Frame-Options 또는 CSP frame-ancestors를 설정하세요.",
    },
    {
      code: "S-MEAS-XCTO",
      title: "X-Content-Type-Options",
      header: "x-content-type-options",
      severity: "moderate",
      test: (v) => /nosniff/i.test(v),
      rec: "X-Content-Type-Options: nosniff",
    },
    {
      code: "S-MEAS-RP",
      title: "Referrer-Policy",
      header: "referrer-policy",
      severity: "moderate",
      test: (v) => v.length > 0,
      rec: "Referrer-Policy를 명시하세요.",
    },
    {
      code: "S-MEAS-PP",
      title: "Permissions-Policy",
      header: "permissions-policy",
      severity: "minor",
      test: (v) => v.length > 0,
      rec: "Permissions-Policy로 민감 API를 제한하세요.",
    },
  ];

  for (const c of checks) {
    const v = hdr(page, c.header);
    const ok = c.test(v);
    hits.push({
      domain: "kq_s",
      code: c.code,
      title: c.title,
      message: ok
        ? `${c.title} 충족${v ? `: ${textSnippet(v, 80)}` : ""}`
        : `${c.title} 미충족 또는 누락`,
      recommendation: c.rec,
      severity: c.severity,
      status: ok ? "pass" : "fail",
      category: "보안 표면",
      subcategory: "HTTP 헤더",
      evidence: v || "(없음)",
    });
  }
  return hits;
}

/** A — 접근성 정적 신호 (axe 아님, Aditus 1차 서버 수집 대응) */
export function checkAccessibility(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (!page.html) {
    hits.push({
      domain: "kq_a",
      code: "A-MEAS-FETCH",
      title: "HTML 수집",
      message: page.error || "HTML을 수집하지 못함",
      recommendation: "대상 URL이 공개 HTML을 반환하는지 확인하세요.",
      severity: "critical",
      status: "fail",
      category: "웹접근성",
      subcategory: "수집",
    });
    return hits;
  }
  const $ = cheerio.load(page.html);

  const lang = $("html").attr("lang") || $("html").attr("xml:lang") || "";
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-LANG",
    title: "html lang 속성",
    message: lang ? `lang="${lang}"` : "html lang 속성 없음",
    recommendation: '최상위 html에 lang="ko" 등을 지정하세요.',
    severity: "serious",
    status: lang.trim() ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "언어",
    selector: "html",
    evidence: lang || "(없음)",
  });

  const title = $("title").first().text().trim();
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-TITLE",
    title: "문서 title",
    message: title ? `title: ${textSnippet(title)}` : "title 요소 비어 있음/없음",
    recommendation: "페이지마다 고유한 title을 제공하세요.",
    severity: "serious",
    status: title ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "제목",
    selector: "title",
  });

  const h1 = $("h1");
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-H1",
    title: "h1 존재",
    message:
      h1.length === 0
        ? "h1 없음"
        : h1.length === 1
          ? `h1 1개: ${textSnippet(h1.first().text())}`
          : `h1 ${h1.length}개 (다중)`,
    recommendation: "페이지당 주요 h1을 1개 권장합니다.",
    severity: h1.length === 0 ? "serious" : "minor",
    status: h1.length === 0 ? "fail" : h1.length > 3 ? "fail" : "pass",
    category: "웹접근성",
    subcategory: "제목 구조",
    selector: "h1",
  });

  // img alt
  const imgs = $("img");
  let imgFail = 0;
  const imgSamples: string[] = [];
  imgs.each((_, el) => {
    const $el = $(el);
    if ($el.attr("role") === "presentation" || $el.attr("aria-hidden") === "true")
      return;
    const alt = $el.attr("alt");
    if (alt === undefined) {
      imgFail += 1;
      if (imgSamples.length < 5) {
        imgSamples.push($el.attr("src") || "(src없음)");
      }
    }
  });
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-IMG-ALT",
    title: "이미지 대체 텍스트(alt)",
    message:
      imgs.length === 0
        ? "img 없음 (해당 없음)"
        : imgFail === 0
          ? `img ${imgs.length}개 모두 alt 속성 존재`
          : `img ${imgs.length}개 중 alt 누락 ${imgFail}개`,
    recommendation: "의미 있는 이미지에 alt를, 장식 이미지는 alt=\"\" 또는 숨김 처리하세요.",
    severity: "critical",
    status: imgs.length === 0 ? "na" : imgFail === 0 ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "대체 텍스트",
    evidence: imgSamples.join(" | ") || undefined,
    selector: "img",
  });

  // input labels
  const inputs = $(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]), select, textarea",
  );
  let unlabeled = 0;
  inputs.each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id");
    const aria = $el.attr("aria-label") || $el.attr("aria-labelledby");
    const titleAttr = $el.attr("title");
    const hasLabel = !!(
      aria ||
      titleAttr ||
      (id && $(`label[for="${cssEscape(id)}"]`).length) ||
      $el.closest("label").length
    );
    if (!hasLabel) unlabeled += 1;
  });
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-LABEL",
    title: "폼 컨트롤 레이블",
    message:
      inputs.length === 0
        ? "입력 컨트롤 없음"
        : unlabeled === 0
          ? `입력 ${inputs.length}개 레이블 연결 OK`
          : `입력 ${inputs.length}개 중 레이블 없는 항목 ${unlabeled}개`,
    recommendation: "label for / aria-label / aria-labelledby를 연결하세요.",
    severity: "serious",
    status: inputs.length === 0 ? "na" : unlabeled === 0 ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "레이블",
    selector: "input,select,textarea",
  });

  // skip link
  const skip = $('a[href^="#"]').filter((_, el) => {
    const t = $(el).text().replace(/\s+/g, "");
    return /건너뛰|본문|skip/i.test(t);
  });
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-SKIP",
    title: "본문 건너뛰기 링크",
    message: skip.length
      ? `건너뛰기 링크 ${skip.length}개`
      : "본문 건너뛰기 링크 미검출",
    recommendation: "반복 영역 건너뛰기 링크를 페이지 상단에 제공하세요.",
    severity: "moderate",
    status: skip.length ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "건너뛰기 링크",
  });

  // empty buttons
  let emptyBtn = 0;
  $("button, [role=button]").each((_, el) => {
    const $el = $(el);
    const name =
      $el.attr("aria-label") ||
      $el.attr("title") ||
      $el.text().replace(/\s+/g, "") ||
      $el.find("img").attr("alt") ||
      "";
    if (!name) emptyBtn += 1;
  });
  const btnCount = $("button, [role=button]").length;
  hits.push({
    domain: "kq_a",
    code: "A-MEAS-BTN-NAME",
    title: "버튼 접근 가능 이름",
    message:
      btnCount === 0
        ? "button 없음"
        : emptyBtn === 0
          ? `button ${btnCount}개 이름 OK`
          : `이름 없는 button ${emptyBtn}/${btnCount}`,
    recommendation: "아이콘 버튼에 aria-label 또는 숨김 텍스트를 제공하세요.",
    severity: "serious",
    status: btnCount === 0 ? "na" : emptyBtn === 0 ? "pass" : "fail",
    category: "웹접근성",
    subcategory: "이름·역할·값",
  });

  return hits;
}

function cssEscape(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** R — 반응형 정적 신호 */
export function checkResponsive(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (!page.html) return hits;
  const $ = cheerio.load(page.html);
  const vp = $('meta[name="viewport"]').attr("content") || "";
  const vpOk = /width\s*=\s*device-width/i.test(vp);
  hits.push({
    domain: "kq_r",
    code: "R-MEAS-VIEWPORT",
    title: "viewport 메타",
    message: vpOk ? `viewport: ${textSnippet(vp)}` : vp ? `비권장 viewport: ${vp}` : "viewport 메타 없음",
    recommendation: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    severity: "serious",
    status: vpOk ? "pass" : "fail",
    category: "반응형 품질",
    subcategory: "viewport",
    evidence: vp || "(없음)",
  });

  // fixed pixel tables / wide inline widths
  let wideFixed = 0;
  $("[width], [style]").each((_, el) => {
    const $el = $(el);
    const w = $el.attr("width");
    if (w && /^\d+$/.test(w) && Number(w) >= 980) wideFixed += 1;
    const st = $el.attr("style") || "";
    const m = /width\s*:\s*(\d+)px/i.exec(st);
    if (m && Number(m[1]) >= 1200) wideFixed += 1;
  });
  hits.push({
    domain: "kq_r",
    code: "R-MEAS-FIXED-WIDTH",
    title: "과도한 고정 폭",
    message:
      wideFixed === 0
        ? "980px+ 고정 width 인라인 신호 약함"
        : `넓은 고정폭 신호 ${wideFixed}건`,
    recommendation: "고정 px 레이아웃 대신 유동/그리드·max-width를 사용하세요.",
    severity: "moderate",
    status: wideFixed === 0 ? "pass" : "fail",
    category: "반응형 품질",
    subcategory: "레이아웃",
  });

  const mq =
    (page.html.match(/@media/gi) || []).length +
    $('link[rel="stylesheet"]').length;
  hits.push({
    domain: "kq_r",
    code: "R-MEAS-CSS-SIGNAL",
    title: "스타일시트/미디어쿼리 신호",
    message: `@media ${ (page.html.match(/@media/gi) || []).length } · stylesheet link ${$('link[rel="stylesheet"]').length}`,
    recommendation: "반응형 브레이크포인트를 CSS로 제공하세요(정적 힌트).",
    severity: "minor",
    status: mq > 0 ? "pass" : "fail",
    category: "반응형 품질",
    subcategory: "CSS",
  });

  return hits;
}

/** D — 디자인 토큰/문서 힌트 (완전 KRDS 매칭 아님) */
export function checkDesign(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (!page.html) return hits;
  const $ = cheerio.load(page.html);
  const rootStyle = $(":root, html, body").attr("style") || "";
  const hasCssVars =
    /--[a-z0-9-]+\s*:/i.test(page.html) || /var\(--/i.test(page.html);
  hits.push({
    domain: "kq_d",
    code: "D-MEAS-CSS-VARS",
    title: "CSS 커스텀 프로퍼티(토큰 신호)",
    message: hasCssVars
      ? "CSS 변수(var(--…)) 사용 신호 있음"
      : "CSS 변수 토큰 신호 약함(정적 HTML 기준)",
    recommendation: "KRDS 디자인 토큰을 CSS 변수로 적용하세요.",
    severity: "minor",
    status: hasCssVars ? "pass" : "fail",
    category: "디자인 토큰",
    subcategory: "토큰",
    evidence: textSnippet(rootStyle, 80),
  });

  const inlineFont = (page.html.match(/style\s*=\s*["'][^"']*font-size\s*:/gi) || [])
    .length;
  hits.push({
    domain: "kq_d",
    code: "D-MEAS-INLINE-FONT",
    title: "인라인 font-size 남용 신호",
    message:
      inlineFont === 0
        ? "인라인 font-size 거의 없음"
        : `인라인 font-size 약 ${inlineFont}건`,
    recommendation: "타이포 스케일을 토큰/클래스로 일원화하세요.",
    severity: "minor",
    status: inlineFont > 25 ? "fail" : "pass",
    category: "타이포그래피",
    subcategory: "인라인",
  });

  const favicon = $('link[rel*="icon"]').length > 0;
  hits.push({
    domain: "kq_d",
    code: "D-MEAS-FAVICON",
    title: "파비콘",
    message: favicon ? "favicon 링크 존재" : "favicon 링크 없음",
    recommendation: "브랜드 일관성을 위해 favicon을 제공하세요.",
    severity: "minor",
    status: favicon ? "pass" : "fail",
    category: "디자인 토큰",
    subcategory: "아이콘",
  });

  return hits;
}

/** I — 인터페이스/시맨틱 부품 */
export function checkInterface(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (!page.html) return hits;
  const $ = cheerio.load(page.html);

  const main = $("main, [role=main]").length;
  hits.push({
    domain: "kq_i",
    code: "I-MEAS-MAIN",
    title: "main 랜드마크",
    message: main ? `main/role=main ${main}개` : "main 랜드마크 없음",
    recommendation: "주요 콘텐츠를 main으로 감싸세요.",
    severity: "moderate",
    status: main ? "pass" : "fail",
    category: "컴포넌트",
    subcategory: "랜드마크",
  });

  const nav = $("nav, [role=navigation]").length;
  hits.push({
    domain: "kq_i",
    code: "I-MEAS-NAV",
    title: "navigation 랜드마크",
    message: nav ? `nav ${nav}개` : "nav 없음",
    recommendation: "주요 탐색 영역에 nav를 사용하세요.",
    severity: "minor",
    status: nav ? "pass" : "fail",
    category: "컴포넌트",
    subcategory: "내비",
  });

  // buttons without type in forms
  let badType = 0;
  $("form button").each((_, el) => {
    const t = ($(el).attr("type") || "submit").toLowerCase();
    if (!["submit", "button", "reset"].includes(t)) badType += 1;
  });
  const formBtn = $("form button").length;
  hits.push({
    domain: "kq_i",
    code: "I-MEAS-BTN-TYPE",
    title: "form 내부 button type",
    message:
      formBtn === 0
        ? "form button 없음"
        : badType
          ? `비정상 type ${badType}`
          : `form button ${formBtn}개 type OK`,
    recommendation: '의도치 않은 submit 방지를 위해 type="button"|submit 명시',
    severity: "minor",
    status: formBtn === 0 ? "na" : badType ? "fail" : "pass",
    category: "컴포넌트",
    subcategory: "버튼",
  });

  const tables = $("table");
  let tableNoTh = 0;
  tables.each((_, el) => {
    if ($(el).find("th").length === 0) tableNoTh += 1;
  });
  hits.push({
    domain: "kq_i",
    code: "I-MEAS-TABLE-TH",
    title: "표 헤더(th)",
    message:
      tables.length === 0
        ? "table 없음"
        : tableNoTh === 0
          ? `table ${tables.length}개 th 존재`
          : `th 없는 table ${tableNoTh}/${tables.length}`,
    recommendation: "데이터 표에 th 또는 scope를 제공하세요.",
    severity: "moderate",
    status: tables.length === 0 ? "na" : tableNoTh === 0 ? "pass" : "fail",
    category: "컴포넌트",
    subcategory: "표",
  });

  return hits;
}

/** U — 사용자 흐름 힌트 (단일 페이지 정적) */
export function checkUserFlow(page: FetchedPage): MeasuredHit[] {
  const hits: MeasuredHit[] = [];
  if (!page.html) return hits;
  const $ = cheerio.load(page.html);

  const forms = $("form");
  hits.push({
    domain: "kq_u",
    code: "U-MEAS-FORM",
    title: "form 존재·method",
    message:
      forms.length === 0
        ? "form 없음 (정보형 페이지 가능)"
        : `form ${forms.length}개`,
    recommendation: "신청·로그인 흐름은 form과 명확한 action/method를 사용하세요.",
    severity: "minor",
    status: "pass",
    category: "서비스 패턴",
    subcategory: "폼",
  });

  let formNoAction = 0;
  forms.each((_, el) => {
    const $el = $(el);
    const action = $el.attr("action");
    const onsubmit = $el.attr("onsubmit");
    // SPA may omit action — warn only if also no method/post patterns
    if (action === undefined && !onsubmit && $el.find("[type=submit]").length) {
      formNoAction += 1;
    }
  });
  hits.push({
    domain: "kq_u",
    code: "U-MEAS-FORM-ACTION",
    title: "제출 form action 힌트",
    message:
      forms.length === 0
        ? "form 없음"
        : formNoAction
          ? `action 없는 제출 form 추정 ${formNoAction}개(SPA 가능)`
          : "제출 form action/힌트 OK",
    recommendation: "서버 제출 시 action을, SPA면 명시적 JS 제출 경로를 문서화하세요.",
    severity: "minor",
    status: forms.length === 0 ? "na" : formNoAction ? "fail" : "pass",
    category: "서비스 패턴",
    subcategory: "제출",
  });

  const errLike = $("[aria-invalid=true], .error, .is-error, .has-error, #error").length;
  hits.push({
    domain: "kq_u",
    code: "U-MEAS-ERROR-SLOT",
    title: "오류 영역 슬롯 신호",
    message: errLike
      ? `오류/aria-invalid 신호 ${errLike}`
      : "정적 HTML에서 오류 슬롯 약함(정상일 수 있음)",
    recommendation: "폼 오류 시 메시지 영역과 aria-invalid 패턴을 준비하세요.",
    severity: "minor",
    status: "pass", // informational pass
    category: "서비스 패턴",
    subcategory: "오류",
  });

  // 404-ish
  const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 500);
  const looks404 = /404|페이지를 찾을 수 없|not found/i.test(bodyText) && page.status >= 400;
  hits.push({
    domain: "kq_u",
    code: "U-MEAS-PAGE-STATUS",
    title: "페이지 HTTP 상태",
    message: `HTTP ${page.status}${looks404 ? " · 오류 페이지 문구" : ""}`,
    recommendation: "진단 대상은 200 OK 콘텐츠 URL을 사용하세요.",
    severity: page.status >= 400 ? "serious" : "minor",
    status: page.status >= 400 ? "fail" : page.status ? "pass" : "fail",
    category: "서비스 패턴",
    subcategory: "상태",
    evidence: `status=${page.status}`,
  });

  return hits;
}

export function runAllChecks(page: FetchedPage): MeasuredHit[] {
  return [
    ...checkSecurity(page),
    ...checkAccessibility(page),
    ...checkResponsive(page),
    ...checkDesign(page),
    ...checkInterface(page),
    ...checkUserFlow(page),
  ];
}
