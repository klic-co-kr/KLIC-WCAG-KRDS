import type { RuleDef, RuleDomain } from "../types";
import { KQ_AXES, KQ_META, RADIUS_WORD, radiusLabel } from "../kq";
import summaryJson from "./data/summary.json";
import kq_d from "./data/kq_d.json";
import kq_i from "./data/kq_i.json";
import kq_u from "./data/kq_u.json";
import kq_a from "./data/kq_a.json";
import kq_s from "./data/kq_s.json";
import kq_r from "./data/kq_r.json";

const DOMAIN_ORDER: RuleDomain[] = [...KQ_AXES];

const LABEL: Record<RuleDomain, string> = {
  kq_r: radiusLabel("kq_r"),
  kq_a: radiusLabel("kq_a"),
  kq_d: radiusLabel("kq_d"),
  kq_i: radiusLabel("kq_i"),
  kq_u: radiusLabel("kq_u"),
  kq_s: radiusLabel("kq_s"),
};

const CATALOG: Record<RuleDomain, RuleDef[]> = {
  kq_d: kq_d as RuleDef[],
  kq_i: kq_i as RuleDef[],
  kq_u: kq_u as RuleDef[],
  kq_a: kq_a as RuleDef[],
  kq_s: kq_s as RuleDef[],
  kq_r: kq_r as RuleDef[],
};

export function getCatalog(): Record<RuleDomain, RuleDef[]> {
  return CATALOG;
}

export function getAllRules(): RuleDef[] {
  return DOMAIN_ORDER.flatMap((d) => CATALOG[d]);
}

export function getRulesByDomain(domain: RuleDomain): RuleDef[] {
  return CATALOG[domain] ?? [];
}

export function getRuleById(id: string): RuleDef | undefined {
  return getAllRules().find((r) => r.id === id);
}

export function getCatalogSummary() {
  const liveCounts = Object.fromEntries(
    DOMAIN_ORDER.map((d) => [d, CATALOG[d].length]),
  ) as Record<RuleDomain, number> & {
    total: number;
    mcpOfficial: number;
    klicExt: number;
  };
  liveCounts.total = getAllRules().length;
  liveCounts.mcpOfficial =
    CATALOG.kq_d.length + CATALOG.kq_i.length + CATALOG.kq_u.length;
  liveCounts.klicExt =
    CATALOG.kq_a.length + CATALOG.kq_s.length + CATALOG.kq_r.length;

  const { mcpPath: _p, ...publicSummary } = summaryJson as typeof summaryJson & {
    mcpPath?: string;
  };
  void _p;

  const radiusAxes = DOMAIN_ORDER.map((d) => ({
    domain: d,
    letter: KQ_META[d].radiusLetter,
    code: KQ_META[d].axisCode,
    name: KQ_META[d].radiusName,
    label: LABEL[d],
    source: KQ_META[d].source,
    weight: KQ_META[d].weight,
    count: CATALOG[d].length,
  }));

  return {
    ...publicSummary,
    taxonomy: "RADIUS",
    brand: RADIUS_WORD,
    expand:
      "R Responsive · A Accessibility · D Design · I Interface · U User flow · S Security",
    liveCounts,
    labels: LABEL,
    domains: DOMAIN_ORDER,
    axes: KQ_META,
    radiusAxes,
    honesty:
      "S-axis security headers measured; other RADIUS axes simulated — not compliance rates.",
  };
}

export function domainLabel(domain: RuleDomain): string {
  return LABEL[domain] ?? domain;
}

export function listCategories(domain?: RuleDomain) {
  const rules = domain ? getRulesByDomain(domain) : getAllRules();
  const map = new Map<
    string,
    { domain: RuleDomain; category: string; subcategory: string; count: number }
  >();
  for (const r of rules) {
    const key = `${r.domain}::${r.category}::${r.subcategory}`;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else
      map.set(key, {
        domain: r.domain,
        category: r.category,
        subcategory: r.subcategory,
        count: 1,
      });
  }
  return [...map.values()].sort((a, b) =>
    a.domain === b.domain
      ? a.category.localeCompare(b.category, "ko") ||
        a.subcategory.localeCompare(b.subcategory, "ko")
      : DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain),
  );
}

export { DOMAIN_ORDER, LABEL as DOMAIN_LABELS, KQ_META, RADIUS_WORD };
