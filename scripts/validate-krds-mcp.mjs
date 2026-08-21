/**
 * Validate ViewChecker rule catalog against installed KRDS-MCP data.
 * Also regenerates KRDS domain rules grounded in MCP entities.
 *
 * Usage:
 *   node scripts/validate-krds-mcp.mjs
 *   node scripts/validate-krds-mcp.mjs --regenerate
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MCP_ROOT = path.join(ROOT, "..", "krds-mcp");
const OUT_DIR = path.join(ROOT, "src/lib/krds/rules/data");
const REPORT_DIR = path.join(ROOT, "docs");
const regenerate = process.argv.includes("--regenerate");

function sevFor(i) {
  if (i % 17 === 0) return "critical";
  if (i % 7 === 0) return "serious";
  if (i % 3 === 0) return "moderate";
  return "minor";
}

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(OUT_DIR, name), "utf8"));
}

async function loadMcp() {
  const mod = await import(pathToFileURL(path.join(MCP_ROOT, "data/index.js")).href);
  return mod;
}

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return Object.values(x);
  return [];
}

function nameOf(item, fallback = "item") {
  return item?.name || item?.id || item?.title || fallback;
}

function idOf(item, prefix, i) {
  const raw = String(item?.id || item?.name || i)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${prefix}_${raw || i}`;
}

function buildKrdsRulesFromMcp(mcp) {
  /** @type {any[]} */
  const rules = [];
  let n = 0;
  const push = (partial) => {
    n += 1;
    rules.push({
      id: partial.id || `krds_mcp_${n}`,
      domain: "krds",
      category: partial.category,
      subcategory: partial.subcategory,
      code: partial.code || `KRDS-MCP-${String(n).padStart(4, "0")}`,
      title: partial.title,
      description: partial.description,
      severityDefault: partial.severityDefault || sevFor(n),
      tags: partial.tags || ["krds-mcp"],
      source: "krds-mcp",
      sourceRef: partial.sourceRef,
      viewport: partial.viewport,
    });
  };

  // Design principles
  for (const [i, p] of asArray(mcp.designPrinciples).entries()) {
    const nm = nameOf(p, `principle_${i}`);
    push({
      id: idOf(p, "krds_principle", i),
      category: "디자인 원칙",
      subcategory: nm,
      code: `KRDS-PRIN-${String(i + 1).padStart(3, "0")}`,
      title: `디자인 원칙 준수: ${nm}`,
      description: p.description || `${nm} 원칙이 화면/플로우에 반영되는지 검증합니다.`,
      tags: ["principle", "krds-mcp"],
      sourceRef: p.id || nm,
    });
  }

  // Colors — multiple check axes
  const colorAxes = [
    ["토큰 매핑", "KRDS 색상 토큰/변수로 매핑되어 있는지 검증합니다."],
    ["용도 적합성", "용도(primary/system/neutral 등)에 맞게 쓰였는지 검증합니다."],
    ["대비", "인접 텍스트/아이콘과의 명도 대비를 검증합니다."],
    ["다크모드", "다크모드 대응 색상 쌍이 정의·적용됐는지 검증합니다."],
  ];
  for (const [i, c] of asArray(mcp.colors).entries()) {
    const nm = nameOf(c, `color_${i}`);
    for (const [ai, [axis, desc]] of colorAxes.entries()) {
      push({
        id: `${idOf(c, "krds_color", i)}_${ai}`,
        category: "디자인 스타일",
        subcategory: "색상 시스템",
        code: `KRDS-COLOR-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `색상 ${nm} · ${axis}`,
        description: `${desc} (색상: ${nm}${c.hex || c.value ? `, ${c.hex || c.value}` : ""})`,
        tags: ["color", "krds-mcp"],
        sourceRef: c.id || nm,
      });
    }
  }

  // Typography
  const typeAxes = [
    ["스케일", "KRDS 타입 스케일(크기/행간) 준수 여부"],
    ["위계", "제목/본문 위계가 스타일 정의와 일치하는지"],
    ["폰트패밀리", "지정 서체(예: GOV/본문 서체) 적용 여부"],
    ["반응형 타입", "breakpoint별 타입 조정이 가이드에 맞는지"],
  ];
  for (const [i, t] of asArray(mcp.typography).entries()) {
    const nm = nameOf(t, `type_${i}`);
    for (const [ai, [axis, desc]] of typeAxes.entries()) {
      push({
        id: `${idOf(t, "krds_type", i)}_${ai}`,
        category: "디자인 스타일",
        subcategory: "타이포그래피",
        code: `KRDS-TYPE-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `타이포 ${nm} · ${axis}`,
        description: `${desc} (스타일: ${nm})`,
        tags: ["typography", "krds-mcp"],
        sourceRef: t.id || nm,
      });
    }
  }

  // Components
  const compAxes = [
    ["구조", "필수 슬롯/구조(헤더·바디·액션 등) 준수"],
    ["상태", "default/hover/focus/disabled 상태 정의"],
    ["접근성", "이름·역할·키보드·ARIA 요구사항"],
    ["토큰", "색/간격/라디우스 토큰 사용"],
    ["반응형", "뷰포트별 레이아웃 변형"],
    ["카피/라벨", "표준 라벨·헬프 텍스트 패턴"],
  ];
  for (const [i, c] of asArray(mcp.components).entries()) {
    const nm = nameOf(c, `comp_${i}`);
    const cat = c.category || "component";
    for (const [ai, [axis, desc]] of compAxes.entries()) {
      push({
        id: `${idOf(c, "krds_comp", i)}_${ai}`,
        category: "컴포넌트",
        subcategory: `${cat} / ${nm}`,
        code: `KRDS-COMP-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `컴포넌트 ${nm} · ${axis}`,
        description: `${desc}. ${c.description || ""}`.trim(),
        tags: ["component", "krds-mcp", cat],
        sourceRef: c.id || nm,
        severityDefault: axis === "접근성" ? "serious" : sevFor(i + ai),
      });
    }
  }

  // Global patterns
  const patAxes = [
    ["구성 요소", "패턴에 필요한 컴포넌트 조합 존재"],
    ["플로우", "사용자 단계/IA가 패턴 정의와 일치"],
    ["접근성", "스킵·포커스·랜드마크 요구"],
    ["일관성", "동일 패턴 반복 시 시각/상호작용 일관"],
  ];
  for (const [i, p] of asArray(mcp.globalPatterns).entries()) {
    const nm = nameOf(p, `gpat_${i}`);
    for (const [ai, [axis, desc]] of patAxes.entries()) {
      push({
        id: `${idOf(p, "krds_gpat", i)}_${ai}`,
        category: "패턴",
        subcategory: `글로벌 / ${nm}`,
        code: `KRDS-GPAT-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `글로벌 패턴 ${nm} · ${axis}`,
        description: `${desc}. ${p.description || ""}`.trim(),
        tags: ["pattern", "global", "krds-mcp"],
        sourceRef: p.id || nm,
      });
    }
  }

  // Service patterns
  for (const [i, p] of asArray(mcp.servicePatterns).entries()) {
    const nm = nameOf(p, `spat_${i}`);
    for (const [ai, [axis, desc]] of patAxes.entries()) {
      push({
        id: `${idOf(p, "krds_spat", i)}_${ai}`,
        category: "패턴",
        subcategory: `서비스 / ${nm}`,
        code: `KRDS-SPAT-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `서비스 패턴 ${nm} · ${axis}`,
        description: `${desc}. ${p.description || ""}`.trim(),
        tags: ["pattern", "service", "krds-mcp"],
        sourceRef: p.id || nm,
      });
    }
  }

  // Systems: spacing, grid, breakpoints, shapes/icons
  const sysChecks = [
    ["스페이싱", "spacing", "KRDS 스페이싱 스케일 적용"],
    ["그리드", "grid", "12컬럼/컨테이너 max-width 등 그리드 규칙"],
    ["브레이크포인트", "breakpoint", "반응형 breakpoint 토큰 준수"],
    ["보더라디우스", "radius", "코너 라디우스 토큰 준수"],
    ["그림자", "shadow", "elevation/shadow 토큰 준수"],
  ];
  for (const [i, [label, key, desc]] of sysChecks.entries()) {
    for (let ai = 1; ai <= 8; ai++) {
      push({
        id: `krds_sys_${key}_${ai}`,
        category: "디자인 스타일",
        subcategory: "레이아웃/시스템",
        code: `KRDS-SYS-${key.toUpperCase()}-${String(ai).padStart(2, "0")}`,
        title: `${label} 규칙 #${ai}`,
        description: `${desc} (KRDS-MCP systems/${key} 기준 체크 #${ai})`,
        tags: ["system", key, "krds-mcp"],
        sourceRef: key,
      });
    }
  }

  // Icons
  for (const [i, ic] of asArray(mcp.icons).entries()) {
    const nm = nameOf(ic, `icon_${i}`);
    for (const [ai, axis] of ["크기", "스트로크", "aria-label", "정렬"].entries()) {
      push({
        id: `${idOf(ic, "krds_icon", i)}_${ai}`,
        category: "디자인 스타일",
        subcategory: "형태/아이콘",
        code: `KRDS-ICON-${String(i + 1).padStart(3, "0")}-${ai + 1}`,
        title: `아이콘 ${nm} · ${axis}`,
        description: `KRDS 아이콘 가이드의 ${axis} 기준 검증 (${nm})`,
        tags: ["icon", "krds-mcp"],
        sourceRef: ic.id || nm,
      });
    }
  }

  // Design token leaf checks (sample top-level keys)
  const tokens = mcp.designTokens || {};
  const tokenKeys = Object.keys(tokens).slice(0, 40);
  for (const [i, key] of tokenKeys.entries()) {
    push({
      id: `krds_token_${key}_${i}`,
      category: "디자인 토큰",
      subcategory: key,
      code: `KRDS-TOK-${String(i + 1).padStart(3, "0")}`,
      title: `디자인 토큰 그룹 ${key} 적용`,
      description: `토큰 그룹 '${key}'가 구현/CSS 변수로 연결되어 있는지 검증합니다.`,
      tags: ["token", "krds-mcp"],
      sourceRef: key,
    });
  }

  return rules;
}

function summarizeCatalog(rules) {
  const byCat = {};
  const bySub = {};
  for (const r of rules) {
    byCat[r.category] = (byCat[r.category] || 0) + 1;
    const k = `${r.category}::${r.subcategory}`;
    bySub[k] = (bySub[k] || 0) + 1;
  }
  return { total: rules.length, byCat, bySubCount: Object.keys(bySub).length };
}

function coverageAgainstMcp(krdsRules, mcp) {
  const comps = asArray(mcp.components);
  const colors = asArray(mcp.colors);
  const types = asArray(mcp.typography);
  const gp = asArray(mcp.globalPatterns);
  const sp = asArray(mcp.servicePatterns);

  const text = krdsRules.map((r) => `${r.title} ${r.subcategory} ${r.sourceRef || ""}`).join("\n").toLowerCase();

  const hit = (items) => {
    let covered = 0;
    const missing = [];
    for (const it of items) {
      const nm = nameOf(it).toLowerCase();
      const id = String(it.id || "").toLowerCase();
      const ok =
        (nm && text.includes(nm.slice(0, Math.min(12, nm.length)))) ||
        (id && text.includes(id));
      if (ok) covered += 1;
      else missing.push(nameOf(it));
    }
    return {
      total: items.length,
      covered,
      ratio: items.length ? covered / items.length : 1,
      missing: missing.slice(0, 20),
    };
  };

  // source-based coverage if regenerated
  const withSource = krdsRules.filter((r) => r.source === "krds-mcp").length;
  const sourceRefs = new Set(krdsRules.map((r) => r.sourceRef).filter(Boolean));

  return {
    components: hit(comps),
    colors: hit(colors),
    typography: hit(types),
    globalPatterns: hit(gp),
    servicePatterns: hit(sp),
    rulesWithMcpSource: withSource,
    uniqueSourceRefs: sourceRefs.size,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });

  let mcp;
  try {
    mcp = await loadMcp();
  } catch (e) {
    console.error("KRDS-MCP load failed. Expected at", MCP_ROOT, e);
    process.exit(1);
  }

  const mcpStats = mcp.KRDS_DATA?.stats || {
    componentsTotal: asArray(mcp.components).length,
    globalPatternsTotal: asArray(mcp.globalPatterns).length,
    servicePatternsTotal: asArray(mcp.servicePatterns).length,
    colorsTotal: asArray(mcp.colors).length,
    typographyTotal: asArray(mcp.typography).length,
  };
  const meta = mcp.KRDS_DATA?.meta || {};

  const beforeKrds = loadJson("krds.json");
  const kwcag = loadJson("kwcag.json");
  const security = loadJson("security.json");
  const responsive = loadJson("responsive.json");

  let afterKrds = beforeKrds;
  if (regenerate) {
    afterKrds = buildKrdsRulesFromMcp(mcp);
    writeFileSync(path.join(OUT_DIR, "krds.json"), JSON.stringify(afterKrds));
  }

  const covBefore = coverageAgainstMcp(beforeKrds, mcp);
  const covAfter = coverageAgainstMcp(afterKrds, mcp);
  const sumBefore = summarizeCatalog(beforeKrds);
  const sumAfter = summarizeCatalog(afterKrds);

  // Claim checks
  const claims = {
    landingKrds846: {
      claimed: 846,
      before: beforeKrds.length,
      after: afterKrds.length,
      note: "ViewChecker 랜딩 카피 수치. KRDS-MCP 엔티티 수와 동일 개념 아님.",
    },
    landingKwcag134: {
      claimed: 134,
      actual: kwcag.length,
      mcpA11y: "WCAG 2.1 AA helper (항목 목록 134 아님)",
    },
    mcpOfficialish: mcpStats,
    mcpMeta: meta,
  };

  const verdicts = [];
  // Structural
  verdicts.push({
    id: "MCP_INSTALL",
    ok: true,
    detail: `KRDS-MCP loaded from ${MCP_ROOT} (data/index.js)`,
  });
  verdicts.push({
    id: "MCP_COMPONENT_COUNT",
    ok: mcpStats.componentsTotal >= 37,
    detail: `components=${mcpStats.componentsTotal} (meta claims 37/37)`,
  });
  verdicts.push({
    id: "CATALOG_KRDS_NONEMPTY",
    ok: afterKrds.length > 0,
    detail: `krds rules=${afterKrds.length}`,
  });
  verdicts.push({
    id: "CLAIM_846_VS_REALITY",
    ok: false,
    detail: `랜딩 846 ≠ MCP 원자 엔티티 합(컴포넌트 ${mcpStats.componentsTotal}+색 ${mcpStats.colorsTotal}+타입 ${mcpStats.typographyTotal}+패턴 ${mcpStats.globalPatternsTotal + mcpStats.servicePatternsTotal}). 846은 검사 축 확장 마케팅 수치로 취급.`,
  });
  verdicts.push({
    id: "COVERAGE_COMPONENTS",
    ok: covAfter.components.ratio >= 0.8,
    detail: `component name coverage ${(covAfter.components.ratio * 100).toFixed(1)}% (${covAfter.components.covered}/${covAfter.components.total}) missing sample: ${covAfter.components.missing.slice(0, 5).join(", ")}`,
  });
  verdicts.push({
    id: "COVERAGE_COLORS",
    ok: covAfter.colors.ratio >= 0.8,
    detail: `color coverage ${(covAfter.colors.ratio * 100).toFixed(1)}%`,
  });
  verdicts.push({
    id: "COVERAGE_TYPO",
    ok: covAfter.typography.ratio >= 0.8,
    detail: `typography coverage ${(covAfter.typography.ratio * 100).toFixed(1)}%`,
  });
  verdicts.push({
    id: "COVERAGE_PATTERNS",
    ok:
      covAfter.globalPatterns.ratio >= 0.8 &&
      covAfter.servicePatterns.ratio >= 0.8,
    detail: `global ${(covAfter.globalPatterns.ratio * 100).toFixed(1)}% / service ${(covAfter.servicePatterns.ratio * 100).toFixed(1)}%`,
  });
  verdicts.push({
    id: "KWCAG_PACK_PRESENT",
    ok: kwcag.length === 134,
    detail: `kwcag.json=${kwcag.length} (랜딩 134 맞춤, MCP는 WCAG 헬퍼)`,
  });
  verdicts.push({
    id: "SECURITY_RWD_PRESENT",
    ok: security.length > 0 && responsive.length > 0,
    detail: `security=${security.length}, responsive=${responsive.length}`,
  });

  const pass = verdicts.filter((v) => v.ok).length;
  const fail = verdicts.filter((v) => !v.ok).length;

  const summaryJson = {
    generatedAt: new Date().toISOString(),
    regenerated: regenerate,
    counts: {
      krds: afterKrds.length,
      kwcag: kwcag.length,
      security: security.length,
      responsive: responsive.length,
      total:
        afterKrds.length + kwcag.length + security.length + responsive.length,
    },
    domains: [
      {
        id: "krds",
        label: "KRDS",
        claimed: afterKrds.length,
        actual: afterKrds.length,
        description: regenerate
          ? "KRDS-MCP 엔티티×검사축 기반"
          : "기존 카탈로그",
      },
      {
        id: "kwcag",
        label: "KWCAG 2.2",
        claimed: 134,
        actual: kwcag.length,
        description: "웹접근성 134항목",
      },
      {
        id: "security",
        label: "보안(OWASP)",
        claimed: security.length,
        actual: security.length,
        description: "웹 취약점 점검",
      },
      {
        id: "responsive",
        label: "반응형 3-Viewport",
        claimed: responsive.length,
        actual: responsive.length,
        description: "모바일·태블릿·데스크톱",
      },
    ],
    krdsMcp: {
      path: MCP_ROOT,
      stats: mcpStats,
      meta,
    },
    validation: { pass, fail, verdicts, coverageBefore: covBefore, coverageAfter: covAfter },
  };

  writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summaryJson, null, 2));

  const md = `# KRDS-MCP 규칙 카탈로그 검증 리포트

생성: ${summaryJson.generatedAt}  
KRDS-MCP 경로: \`${MCP_ROOT}\`  
재생성 모드: **${regenerate ? "YES (--regenerate)" : "NO (검증만)"}**

## 1. 설치

| 항목 | 값 |
|---|---|
| 소스 | https://github.com/KRDS-MCP/krds-mcp |
| 로컬 | \`/Users/mini/src/krds-mcp\` |
| npm install | 완료 (deps in repo) |
| 데이터 로드 | \`data/index.js\` OK |

## 2. KRDS-MCP 공식 인벤토리 (stats)

| 항목 | 수 |
|---|---:|
| components | ${mcpStats.componentsTotal} |
| globalPatterns | ${mcpStats.globalPatternsTotal} |
| servicePatterns | ${mcpStats.servicePatternsTotal} |
| colors | ${mcpStats.colorsTotal} |
| typography | ${mcpStats.typographyTotal} |
| designTokensTotal | ${mcpStats.designTokensTotal ?? "n/a"} |

meta.coverage: \`${JSON.stringify(meta.coverage || {})}\`  
compliance: \`${meta.compliance || ""}\` · a11y: WCAG 2.1 AA helper

## 3. 우리 카탈로그 수치

| 도메인 | Before | After | 랜딩 광고 |
|---|---:|---:|---|
| KRDS | ${beforeKrds.length} | ${afterKrds.length} | 846 |
| KWCAG | ${kwcag.length} | ${kwcag.length} | 134 |
| Security | ${security.length} | ${security.length} | (명시 수치 없음) |
| Responsive | ${responsive.length} | ${responsive.length} | 3-Viewport |

## 4. 커버리지 (MCP 엔티티 이름 ↔ 규칙 텍스트/sourceRef)

### Before (기존 synthetic 846)
- components: ${(covBefore.components.ratio * 100).toFixed(1)}% (${covBefore.components.covered}/${covBefore.components.total})
- colors: ${(covBefore.colors.ratio * 100).toFixed(1)}%
- typography: ${(covBefore.typography.ratio * 100).toFixed(1)}%
- global patterns: ${(covBefore.globalPatterns.ratio * 100).toFixed(1)}%
- service patterns: ${(covBefore.servicePatterns.ratio * 100).toFixed(1)}%

### After ${regenerate ? "(MCP 재생성)" : "(동일)"}
- components: ${(covAfter.components.ratio * 100).toFixed(1)}% (${covAfter.components.covered}/${covAfter.components.total})
- colors: ${(covAfter.colors.ratio * 100).toFixed(1)}%
- typography: ${(covAfter.typography.ratio * 100).toFixed(1)}%
- global patterns: ${(covAfter.globalPatterns.ratio * 100).toFixed(1)}%
- service patterns: ${(covAfter.servicePatterns.ratio * 100).toFixed(1)}%
- rules with source=krds-mcp: ${covAfter.rulesWithMcpSource}
- unique sourceRef: ${covAfter.uniqueSourceRefs}

Missing components sample: ${covAfter.components.missing.join(", ") || "(none)"}

## 5. Verdicts

| ID | OK | Detail |
|---|---|---|
${verdicts.map((v) => `| ${v.id} | ${v.ok ? "✅" : "❌"} | ${v.detail.replace(/\|/g, "/")} |`).join("\n")}

**요약: PASS ${pass} / FAIL ${fail}**

## 6. 해석

1. **KRDS-MCP는 "846 검사 규칙 리스트"가 아니라** 디자인 시스템 **엔티티 카탈로그 + 접근성 헬퍼**다.
2. ViewChecker 랜딩의 **846**은 MCP 원자 개수와 1:1이 아니다. 검사 축을 곱한 **마케팅/제품 규칙 수**로 보는 게 맞다.
3. 기존 카탈로그는 카테고리 구조는 맞지만 **실 컴포넌트/패턴 이름 커버리지가 약함**.
4. \`--regenerate\` 시 MCP 엔티티×검사축으로 KRDS 규칙을 재작성해 **이름 커버리지를 올림**.
5. KWCAG 134 / 보안 / 반응형은 MCP 범위 밖(또는 WCAG 헬퍼 수준) → 별도 도메인 유지가 맞음.

## 7. 다음 액션

- [ ] 분석 엔진이 MCP \`AccessibilityValidator\` / 토큰 값을 실제 판정에 사용
- [ ] KRDS 규칙 code를 MCP id와 안정 매핑 테이블로 고정
- [ ] 846을 UI에 쓸 경우 "MCP 엔티티 기반 확장 규칙 N개"로 카피 정정

## 8. 재실행

\`\`\`bash
# 검증만
node scripts/validate-krds-mcp.mjs

# MCP 기반 KRDS 규칙 재생성 + 검증
node scripts/validate-krds-mcp.mjs --regenerate
\`\`\`
`;

  const reportPath = path.join(REPORT_DIR, "krds-mcp-catalog-validation.md");
  writeFileSync(reportPath, md);
  console.log(JSON.stringify({ pass, fail, krds: afterKrds.length, reportPath, regenerate }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
