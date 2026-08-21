/**
 * Generate KLIC Q-Map catalog:
 *  - KQ-V / KQ-U / KQ-F from official KRDS-MCP only
 *  - KQ-A / KQ-S / KQ-R as KLIC extensions (needed beyond MCP)
 *  - severity via content map (no index modulo)
 *
 * Usage:
 *   node scripts/generate-kq-catalog.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MCP_PKG = path.join(ROOT, "node_modules/@krds-mcp/krds-mcp");
const MCP_CLONE = path.join(ROOT, "..", "krds-mcp");
const OUT = path.join(ROOT, "src/lib/krds/rules/data");

function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return Object.values(x);
  return [];
}

function nameOf(item, fb = "item") {
  if (typeof item === "string") return item;
  return String(item?.nameKo || item?.name || item?.title || item?.id || item?.key || fb);
}

function slug(s, i = 0) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || `n${i}`
  );
}

function pri(s) {
  return s === "critical" ? "P0" : s === "serious" ? "P1" : s === "moderate" ? "P2" : "P3";
}

/** Content-based severity (mirrors src/lib/krds/severity-map.ts) */
function mapSeverity({ domain, category, subcategory, title, tags = [], code = "" }) {
  const blob = `${title} ${subcategory} ${category} ${tags.join(" ")} ${code}`;
  if (domain === "kq_s") {
    if (/주입|injection|xss|sqli|rce|인증우회|권한상승|ssrf|세션고정|평문/i.test(blob))
      return "critical";
    if (/csp|hsts|x-frame|x-content-type|referrer|permissions-policy|cors|cookie|tls|혼합/i.test(blob))
      return "serious";
    if (/권한|인가|csrf|access/i.test(blob)) return "serious";
    return "moderate";
  }
  if (domain === "kq_a") {
    if (/대체.?텍스트|키보드|초점|포커스|명도.?대비/i.test(blob)) return "critical";
    if (/aria|레이블|label|오류|캡션|자막|skip/i.test(blob)) return "serious";
    return "moderate";
  }
  if (domain === "kq_u") {
    if (/오류|예외|흐름 완결|중단|재시도/i.test(blob)) return "serious";
    return "moderate";
  }
  if (domain === "kq_i") {
    if (title.includes("접근성") || tags.includes("접근성")) return "serious";
    if (title.includes("상태")) return "moderate";
    if (title.includes("구조")) return "minor";
    return "moderate";
  }
  if (domain === "kq_d") {
    if (category.includes("원칙") || /대비|contrast/i.test(blob)) return "serious";
    if (category.includes("색") || category.includes("타이포")) return "moderate";
    if (category.includes("토큰")) return "minor";
    return "minor";
  }
  if (domain === "kq_r") {
    if (/가로.?스크롤|터치|viewport|겹침|잘림/i.test(blob)) return "serious";
    return "moderate";
  }
  return "minor";
}

async function loadMcp() {
  const candidates = [
    path.join(MCP_PKG, "dist/data/index.js"),
    path.join(MCP_PKG, "data/index.js"),
    path.join(MCP_CLONE, "data/index.js"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return { mod: await import(pathToFileURL(p).href), path: p };
    }
  }
  throw new Error("KRDS-MCP data not found. npm i @krds-mcp/krds-mcp or clone krds-mcp");
}

function pushRule(rules, partial) {
  const severityDefault =
    partial.severityDefault ||
    mapSeverity({
      domain: partial.domain,
      category: partial.category,
      subcategory: partial.subcategory,
      title: partial.title,
      tags: partial.tags || [],
      code: partial.code,
    });
  rules.push({
    id: partial.id,
    domain: partial.domain,
    axisCode: partial.axisCode,
    category: partial.category,
    subcategory: partial.subcategory,
    code: partial.code,
    title: partial.title,
    description: partial.description,
    severityDefault,
    priorityDefault: partial.priorityDefault || pri(severityDefault),
    tags: partial.tags || [],
    scenes: partial.scenes || ["SC-ALL"],
    source: partial.source,
    sourceRef: partial.sourceRef,
    viewport: partial.viewport || "all",
  });
}

/** Flatten token maps: object of tokens OR {meta,tokens} OR nested groups */
function collectTokenGroups(mod) {
  const groups = new Map(); // groupName -> [{id,value?}]

  function add(group, id, raw) {
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ id, raw });
  }

  function ingestNamed(name, data) {
    if (data == null) return;
    if (Array.isArray(data)) {
      for (const [i, item] of data.entries()) {
        add(name, nameOf(item, `${name}_${i}`), item);
      }
      return;
    }
    if (typeof data !== "object") return;
    // { meta, tokens }
    if (data.tokens && typeof data.tokens === "object") {
      ingestNamed(name, data.tokens);
      return;
    }
    // map id -> token
    for (const [k, v] of Object.entries(data)) {
      if (k === "meta" || k === "stats") continue;
      if (v && typeof v === "object" && !Array.isArray(v) && (v.value != null || v.$value != null || v.css || typeof v === "string")) {
        add(name, k, v);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        // nested category
        const keys = Object.keys(v);
        const looksLikeTokenMap = keys.some(
          (kk) =>
            v[kk] &&
            typeof v[kk] === "object" &&
            (v[kk].value != null || v[kk].$value != null || typeof v[kk] === "string"),
        );
        if (looksLikeTokenMap || keys.length > 0) {
          for (const [kk, vv] of Object.entries(v)) {
            if (vv && typeof vv === "object") add(`${name}/${k}`, kk, vv);
            else add(name, `${k}.${kk}`, vv);
          }
        } else {
          add(name, k, v);
        }
      } else {
        add(name, k, v);
      }
    }
  }

  const bags = [
    ["designTokens", mod.designTokens],
    ["colorTokens", mod.colorTokens],
    ["componentTokens", mod.componentTokens],
    ["layoutTokens", mod.layoutTokens],
    ["motionTokens", mod.motionTokens],
    ["borderTokens", mod.borderTokens],
    ["borderRadius", mod.borderRadius],
    ["breakpoints", mod.breakpoints],
    ["fontScale", mod.fontScale],
    ["fontWeights", mod.fontWeights],
    ["lineHeights", mod.lineHeights],
    ["letterSpacings", mod.letterSpacings],
    ["gridSystem", mod.gridSystem],
  ];
  for (const [n, d] of bags) ingestNamed(n, d);

  return groups;
}

function buildMcpAxes(mcp, mod) {
  const v = [];
  const u = [];
  const f = [];

  for (const [i, p] of asArray(mcp.designPrinciples).entries()) {
    const nm = nameOf(p, `principle_${i}`);
    pushRule(v, {
      id: `kq_d_prin_${slug(nm, i)}`,
      domain: "kq_d",
      axisCode: "D",
      category: "디자인 원칙",
      subcategory: nm,
      code: `D-PR-${String(i + 1).padStart(2, "0")}`,
      title: `원칙 반영: ${nm}`,
      description:
        p.description ||
        `KRDS 디자인 원칙「${nm}」이 화면 구조·카피·인터랙션에 반영되는지 확인합니다.`,
      tags: ["principle", "krds-mcp", "kq-d"],
      source: "krds-mcp",
      sourceRef: p.id || nm,
      scenes: ["SC-ALL"],
    });
  }

  for (const [i, c] of asArray(mcp.colors).entries()) {
    const nm = nameOf(c, `color_${i}`);
    pushRule(v, {
      id: `kq_d_color_${slug(nm, i)}`,
      domain: "kq_d",
      axisCode: "D",
      category: "색상",
      subcategory: nm,
      code: `D-CO-${String(i + 1).padStart(2, "0")}`,
      title: `색 팔레트: ${nm}`,
      description: `KRDS 색「${nm}」이 용도(primary/system/neutral 등)에 맞게 쓰이는지 확인합니다.`,
      tags: ["color", "krds-mcp", "kq-d"],
      source: "krds-mcp",
      sourceRef: c.id || nm,
      scenes: ["SC-ALL"],
    });
  }

  for (const [i, t] of asArray(mcp.typography).entries()) {
    const nm = nameOf(t, `type_${i}`);
    pushRule(v, {
      id: `kq_d_type_${slug(nm, i)}`,
      domain: "kq_d",
      axisCode: "D",
      category: "타이포그래피",
      subcategory: nm,
      code: `D-TY-${String(i + 1).padStart(2, "0")}`,
      title: `타이포: ${nm}`,
      description: `KRDS 타이포「${nm}」스케일(크기·행간·굵기)이 역할에 맞게 적용되는지 확인합니다.`,
      tags: ["typography", "krds-mcp", "kq-d"],
      source: "krds-mcp",
      sourceRef: t.id || nm,
      scenes: ["SC-ALL"],
    });
  }

  // Full token groups from MCP exports
  const tokenGroups = collectTokenGroups(mod);
  let ti = 0;
  let tokenLeafCount = 0;
  for (const [gname, list] of tokenGroups) {
    if (!list.length) continue;
    ti += 1;
    tokenLeafCount += list.length;
    const sample = list
      .slice(0, 3)
      .map((x) => x.id)
      .join(", ");
    pushRule(v, {
      id: `kq_d_tok_${slug(gname, ti)}`,
      domain: "kq_d",
      axisCode: "D",
      category: "디자인 토큰",
      subcategory: gname,
      code: `D-TK-${String(ti).padStart(2, "0")}`,
      title: `토큰 군: ${gname}`,
      description: `KRDS-MCP 토큰 군「${gname}」${list.length}개(예: ${sample})가 CSS/테마 변수로 일관 매핑되는지 확인합니다.`,
      tags: ["design-token", "krds-mcp", "kq-d", gname.split("/")[0]],
      source: "krds-mcp",
      sourceRef: gname,
      scenes: ["SC-ALL"],
    });
  }

  const compAxes = [
    ["구조", "역할·필수 요소·슬롯 구조가 KRDS 명세와 맞는지", ["구조"]],
    ["상태", "default/hover/focus/disabled/error 상태가 정의·표현되는지", ["상태"]],
    ["접근성", "이름·역할·키보드 초점이 보장되는지", ["접근성"]],
  ];
  for (const [i, c] of asArray(mcp.components).entries()) {
    const nm = nameOf(c, `comp_${i}`);
    for (const [j, [axis, desc, tags]] of compAxes.entries()) {
      pushRule(u, {
        id: `kq_i_${slug(nm, i)}_${j}`,
        domain: "kq_i",
        axisCode: "I",
        category: "컴포넌트",
        subcategory: nm,
        code: `I-CP-${String(i + 1).padStart(2, "0")}-${j + 1}`,
        title: `${nm} · ${axis}`,
        description: `${desc} (KRDS-MCP 컴포넌트: ${nm})`,
        tags: ["component", axis, "krds-mcp", "kq-i", ...tags],
        source: "krds-mcp",
        sourceRef: c.id || nm,
        scenes: inferScenesForComponent(nm),
      });
    }
  }

  for (const [i, p] of asArray(mcp.globalPatterns).entries()) {
    const nm = nameOf(p, `gp_${i}`);
    pushRule(f, {
      id: `kq_u_gp_${slug(nm, i)}`,
      domain: "kq_u",
      axisCode: "U",
      category: "글로벌 패턴",
      subcategory: nm,
      code: `U-GP-${String(i + 1).padStart(2, "0")}`,
      title: `글로벌 패턴: ${nm}`,
      description:
        p.description ||
        `공통 패턴「${nm}」이 사이트 전역에서 KRDS 가이드와 맞게 쓰이는지 확인합니다.`,
      tags: ["global-pattern", "krds-mcp", "kq-u"],
      source: "krds-mcp",
      sourceRef: p.id || nm,
      scenes: ["SC-ALL"],
    });
  }

  const spScene = {
    신청: "SC-APPLY",
    검색: "SC-FIND",
    로그인: "SC-AUTH",
    회원: "SC-AUTH",
    정책: "SC-INFO",
    방문: "SC-HOME",
    조회: "SC-FIND",
  };
  for (const [i, p] of asArray(mcp.servicePatterns).entries()) {
    const nm = nameOf(p, `sp_${i}`);
    let scene = "SC-ALL";
    for (const [k, sc] of Object.entries(spScene)) {
      if (nm.includes(k)) {
        scene = sc;
        break;
      }
    }
    for (const [j, [axis, desc]] of [
      ["흐름 완결", "시작→완료까지 단계·피드백·이탈 경로가 완전한지"],
      ["오류·예외", "검증 실패·중단·재시도 UX가 안내되는지"],
    ].entries()) {
      pushRule(f, {
        id: `kq_u_sp_${slug(nm, i)}_${j}`,
        domain: "kq_u",
        axisCode: "U",
        category: "서비스 패턴",
        subcategory: nm,
        code: `U-SP-${String(i + 1).padStart(2, "0")}-${j + 1}`,
        title: `${nm} · ${axis}`,
        description: `${desc} (KRDS 서비스 패턴: ${nm})`,
        tags: ["service-pattern", "krds-mcp", "kq-u"],
        source: "krds-mcp",
        sourceRef: p.id || nm,
        scenes: [scene, "SC-ALL"],
      });
    }
  }

  return { v, u, f, tokenGroupCount: tokenGroups.size, tokenLeafCount };
}

function inferScenesForComponent(nm) {
  const n = nm.toLowerCase();
  const scenes = new Set(["SC-ALL"]);
  if (/button|btn|link|icon/.test(n)) scenes.add("SC-HOME");
  if (/input|text|select|check|radio|form|upload|file/.test(n)) {
    scenes.add("SC-APPLY");
    scenes.add("SC-AUTH");
    scenes.add("SC-FIND");
  }
  if (/modal|dialog|alert|toast|spinner|loading/.test(n)) scenes.add("SC-OPS");
  if (/nav|menu|breadcrumb|tab|pagination/.test(n)) {
    scenes.add("SC-HOME");
    scenes.add("SC-FIND");
  }
  if (/table|list|card|badge|tag/.test(n)) scenes.add("SC-FIND");
  if (/login|password/.test(n)) scenes.add("SC-AUTH");
  return [...scenes];
}

function rebaseExt(oldRules, domain, axisCode, categoryFallback) {
  return (oldRules || []).map((r, i) => {
    const title = r.title || `규칙 ${i + 1}`;
    const category = r.category || categoryFallback;
    const subcategory = r.subcategory || r.category || "일반";
    const codePrefix =
      domain === "kq_a" ? "A" : domain === "kq_s" ? "S" : domain === "kq_r" ? "R" : "X";
    const code = r.code?.match(/^[RADIUS]-/)
      ? r.code
      : `${codePrefix}-${String(i + 1).padStart(3, "0")}`;
    const severityDefault = mapSeverity({
      domain,
      category,
      subcategory,
      title,
      tags: r.tags || [],
      code,
    });
    return {
      id: `${domain}_${String(i + 1).padStart(3, "0")}_${slug(r.code || r.title || i, i)}`,
      domain,
      axisCode,
      category,
      subcategory,
      code,
      title,
      description:
        r.description && r.description.length >= 40
          ? r.description
          : `${title} — ${category}/${subcategory} 기준 준수 여부를 확인합니다. (${code})`,
      severityDefault,
      priorityDefault: pri(severityDefault),
      tags: [...new Set([...(r.tags || []), "klic-ext", domain])],
      scenes: r.scenes || defaultScenesForExt(domain),
      source: "klic-ext",
      sourceRef: r.sourceRef || r.id || r.code,
      viewport: r.viewport || "all",
    };
  });
}

function defaultScenesForExt(domain) {
  if (domain === "kq_a") return ["SC-ALL", "SC-APPLY", "SC-AUTH", "SC-FIND"];
  if (domain === "kq_s") return ["SC-ALL", "SC-AUTH", "SC-APPLY", "SC-PAY"];
  if (domain === "kq_r") return ["SC-ALL", "SC-HOME", "SC-FIND", "SC-APPLY"];
  return ["SC-ALL"];
}

function loadOld(name) {
  const p = path.join(OUT, name);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8"));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { mod, path: mcpPath } = await loadMcp();
  const mcp = {
    designPrinciples: mod.designPrinciples || mod.DESIGN_PRINCIPLES,
    colors: mod.colors || mod.COLORS,
    typography: mod.typography || mod.TYPOGRAPHY,
    designTokens: mod.designTokens || mod.DESIGN_TOKENS,
    components: mod.components || mod.COMPONENTS,
    globalPatterns: mod.globalPatterns || mod.GLOBAL_PATTERNS,
    servicePatterns: mod.servicePatterns || mod.SERVICE_PATTERNS,
  };

  const { v, u, f, tokenGroupCount, tokenLeafCount } = buildMcpAxes(mcp, mod);

  // Prefer legacy lists once for clean RADIUS letter codes (avoid stacked ids)
  const a = rebaseExt(loadOld("kwcag.json").length ? loadOld("kwcag.json") : loadOld("kq_a.json"), "kq_a", "A", "웹접근성");
  const s = rebaseExt(loadOld("security.json").length ? loadOld("security.json") : loadOld("kq_s.json"), "kq_s", "S", "보안 표면");
  const r = rebaseExt(loadOld("responsive.json").length ? loadOld("responsive.json") : loadOld("kq_r.json"), "kq_r", "R", "반응형");

  const files = { kq_d: v, kq_i: u, kq_u: f, kq_a: a, kq_s: s, kq_r: r };

  for (const [k, arr] of Object.entries(files)) {
    writeFileSync(path.join(OUT, `${k}.json`), JSON.stringify(arr, null, 2) + "\n");
  }

  const counts = Object.fromEntries(
    Object.entries(files).map(([k, arr]) => [k, arr.length]),
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const mcpOfficial = counts.kq_d + counts.kq_i + counts.kq_u;
  const klicExt = counts.kq_a + counts.kq_s + counts.kq_r;

  const summary = {
    taxonomy: "RADIUS",
    generatedAt: new Date().toISOString(),
    mcpPath,
    principle: "RADIUS keys 1:1 — D/I/U=KRDS-MCP; R/A/S=KLIC ext",
    keyMap: {
      R: "kq_r",
      A: "kq_a",
      D: "kq_d",
      I: "kq_i",
      U: "kq_u",
      S: "kq_s",
    },
    severity: "content-map (no index modulo)",
    dropped: ["legacy-846 count", "kq_v/kq_f mismatch", "index-based severity"],
    counts: { ...counts, mcpOfficial, klicExt, total },
    tokenCoverage: {
      groups: tokenGroupCount,
      leaves: tokenLeafCount,
      note: "D-axis: one rule per token group; leaf count is inventory",
    },
    axes: {
      kq_r: { axisCode: "R", label: "Responsive", source: "klic-ext", weight: 0.1 },
      kq_a: { axisCode: "A", label: "Accessibility", source: "klic-ext", weight: 0.25 },
      kq_d: { axisCode: "D", label: "Design", source: "krds-mcp", weight: 0.15 },
      kq_i: { axisCode: "I", label: "Interface", source: "krds-mcp", weight: 0.15 },
      kq_u: { axisCode: "U", label: "User flow", source: "krds-mcp", weight: 0.2 },
      kq_s: { axisCode: "S", label: "Security", source: "klic-ext", weight: 0.15 },
    },
    mcpInventory: {
      principles: asArray(mcp.designPrinciples).length,
      colors: asArray(mcp.colors).length,
      typography: asArray(mcp.typography).length,
      components: asArray(mcp.components).length,
      globalPatterns: asArray(mcp.globalPatterns).length,
      servicePatterns: asArray(mcp.servicePatterns).length,
      tokenGroups: tokenGroupCount,
      tokenLeaves: tokenLeafCount,
    },
  };

  writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({ counts: summary.counts, keyMap: summary.keyMap }, null, 2));
  console.log("OK taxonomy=RADIUS keys=R/A/D/I/U/S");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
