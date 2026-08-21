/** User-facing brand — KLIC KRDS / RADIUS */
export const BRAND = {
  productName: "KLIC KRDS",
  productShort: "KLIC KRDS",
  frameworkName: "RADIUS",
  frameworkFull: "KLIC RADIUS",
  companyName: "KLIC",
  companyUrl: "https://klic.co.kr",
  productUrl: "https://krds.klic.co.kr",
  supportEmail: "support@klic.co.kr",
  tagline: "RADIUS · 공공 웹 품질 6축 · 실측 검사",
  description:
    "KLIC RADIUS — R·A·D·I·U·S. Playwright 렌더·axe-core·헤더 실측. D/I/U는 KRDS-MCP 공식 카탈로그, R/A/S는 확장.",
  engine: "klic-radius-inspect-v2",
  reportTitle: "KLIC RADIUS 진단 리포트",
  honesty:
    "실측(Playwright/axe/헤더)만 조치 근거. 카탈로그 시뮬은 참고용.",
  radiusExpand:
    "R Responsive · A Accessibility · D Design · I Interface · U User flow · S Security",
  logoMark: "RADIUS",
  logoText: "KLIC",
} as const;

export const DEMO_ACCOUNTS = {
  demo: { email: "demo@klic.local", role: "standard" as const },
  admin: { email: "admin@klic.local", role: "admin" as const },
};
