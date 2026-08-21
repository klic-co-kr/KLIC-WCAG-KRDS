/** Live probes for measured axes (KQ-S headers first) */

export type ProbeResult = {
  url: string;
  fetchedAt: string;
  ok: boolean;
  status?: number;
  error?: string;
  headers: Record<string, string>;
  finalUrl?: string;
};

const HEADER_KEYS = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "set-cookie",
] as const;

export async function probeUrl(targetUrl: string, timeoutMs = 8000): Promise<ProbeResult> {
  const fetchedAt = new Date().toISOString();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "KLIC-QMap-Probe/1.0 (+https://krds.klic.co.kr)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });
    const headers: Record<string, string> = {};
    for (const k of HEADER_KEYS) {
      const v = res.headers.get(k);
      if (v) headers[k] = v.length > 400 ? `${v.slice(0, 400)}…` : v;
    }
    // also collect any security-ish headers present
    res.headers.forEach((v, k) => {
      if (
        /security|frame|content-type-options|referrer|permission|policy|hsts/i.test(k) &&
        !headers[k]
      ) {
        headers[k] = v.length > 400 ? `${v.slice(0, 400)}…` : v;
      }
    });
    return {
      url: targetUrl,
      fetchedAt,
      ok: res.ok || (res.status >= 300 && res.status < 500),
      status: res.status,
      headers,
      finalUrl: res.url,
    };
  } catch (e) {
    return {
      url: targetUrl,
      fetchedAt,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      headers: {},
    };
  } finally {
    clearTimeout(t);
  }
}

export type HeaderCheck = {
  id: string;
  code: string;
  title: string;
  header: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  pass: (headers: Record<string, string>, meta: { https: boolean; status?: number }) => boolean;
  failMessage: (headers: Record<string, string>) => string;
  recommendation: string;
};

export const KQ_S_HEADER_CHECKS: HeaderCheck[] = [
  {
    id: "kq_s_meas_csp",
    code: "KQ-S-M-CSP",
    title: "Content-Security-Policy 헤더",
    header: "content-security-policy",
    severity: "serious",
    pass: (h) => Boolean(h["content-security-policy"]),
    failMessage: () => "응답에 Content-Security-Policy 헤더가 없습니다.",
    recommendation:
      "CSP를 적용해 스크립트·프레임 출처를 제한하세요. 최소 default-src 'self'부터 단계 도입.",
  },
  {
    id: "kq_s_meas_hsts",
    code: "KQ-S-M-HSTS",
    title: "Strict-Transport-Security (HSTS)",
    header: "strict-transport-security",
    severity: "serious",
    pass: (h, m) => !m.https || Boolean(h["strict-transport-security"]),
    failMessage: () => "HTTPS 응답에 HSTS 헤더가 없습니다.",
    recommendation: "Strict-Transport-Security: max-age=31536000; includeSubDomains 권장.",
  },
  {
    id: "kq_s_meas_xfo",
    code: "KQ-S-M-XFO",
    title: "X-Frame-Options / 프레임 클릭재킹 방어",
    header: "x-frame-options",
    severity: "serious",
    pass: (h) =>
      Boolean(h["x-frame-options"]) ||
      /frame-ancestors/i.test(h["content-security-policy"] || ""),
    failMessage: () => "X-Frame-Options 및 CSP frame-ancestors가 모두 없습니다.",
    recommendation: "X-Frame-Options: DENY(또는 SAMEORIGIN) 또는 CSP frame-ancestors 설정.",
  },
  {
    id: "kq_s_meas_xcto",
    code: "KQ-S-M-XCTO",
    title: "X-Content-Type-Options",
    header: "x-content-type-options",
    severity: "moderate",
    pass: (h) => /nosniff/i.test(h["x-content-type-options"] || ""),
    failMessage: () => "X-Content-Type-Options: nosniff 가 없습니다.",
    recommendation: "X-Content-Type-Options: nosniff 를 모든 응답에 추가하세요.",
  },
  {
    id: "kq_s_meas_rp",
    code: "KQ-S-M-RP",
    title: "Referrer-Policy",
    header: "referrer-policy",
    severity: "moderate",
    pass: (h) => Boolean(h["referrer-policy"]),
    failMessage: () => "Referrer-Policy 헤더가 없습니다.",
    recommendation: "Referrer-Policy: strict-origin-when-cross-origin 등 명시.",
  },
  {
    id: "kq_s_meas_pp",
    code: "KQ-S-M-PP",
    title: "Permissions-Policy",
    header: "permissions-policy",
    severity: "minor",
    pass: (h) => Boolean(h["permissions-policy"]),
    failMessage: () => "Permissions-Policy 헤더가 없습니다.",
    recommendation: "불필요 API(camera, mic, geolocation)를 Permissions-Policy로 제한.",
  },
  {
    id: "kq_s_meas_https",
    code: "KQ-S-M-HTTPS",
    title: "HTTPS 전송",
    header: "(scheme)",
    severity: "critical",
    pass: (_h, m) => m.https,
    failMessage: () => "대상 URL이 HTTPS가 아닙니다.",
    recommendation: "전 구간 HTTPS 및 HTTP→HTTPS 리다이렉트를 적용하세요.",
  },
];
