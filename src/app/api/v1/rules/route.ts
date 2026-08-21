import { NextResponse, type NextRequest } from "next/server";
import {
  DOMAIN_ORDER,
  getCatalogSummary,
  getRulesByDomain,
  listCategories,
} from "@/lib/krds/rules";
import type { RuleDomain } from "@/lib/krds/types";
import { aditusIdsFor } from "@/lib/krds/rules/aditus-insight";
import { htmlExampleFor } from "@/lib/krds/rules/html-examples";
import aditusKwcag22 from "@/lib/krds/rules/data/aditus-kwcag22.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAINS = new Set<string>(DOMAIN_ORDER);
const ADITUS = aditusKwcag22 as unknown as {
  id: number;
  category: string;
  title: string;
  isNew: boolean;
  desc: string;
  detailedDesc: string;
  evaluation: string;
  badExample: string;
  goodExample: string;
  codeSnippet?: string;
}[];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") as RuleDomain | null;
  const category = url.searchParams.get("category");
  const subcategory = url.searchParams.get("subcategory");
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const mode = url.searchParams.get("mode");

  if (mode === "summary" || (!domain && !mode && !q)) {
    return NextResponse.json(getCatalogSummary());
  }
  if (mode === "categories") {
    return NextResponse.json({
      items: listCategories(domain && DOMAINS.has(domain) ? domain : undefined),
    });
  }
  if (mode === "insight") {
    // 카탈로그 규칙 → 인사이트 (KWCAG 상세 + HTML 검사 예시)
    const code = url.searchParams.get("code") || "";
    const sub = url.searchParams.get("subcategory") || "";
    const dom = (url.searchParams.get("domain") || "") as string;
    const ids = aditusIdsFor(code, sub);
    const items = ids
      .map((id) => ADITUS.find((a) => a.id === id))
      .filter((a): a is (typeof ADITUS)[number] => Boolean(a));
    return NextResponse.json({
      code,
      items,
      htmlExample: htmlExampleFor(dom, sub),
    });
  }

  if (domain && !DOMAINS.has(domain)) {
    return NextResponse.json({ error: "invalid domain" }, { status: 400 });
  }

  let items = domain
    ? getRulesByDomain(domain)
    : DOMAIN_ORDER.flatMap((d) => getRulesByDomain(d));

  if (category) items = items.filter((r) => r.category === category);
  if (subcategory) items = items.filter((r) => r.subcategory === subcategory);
  if (q) {
    items = items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.subcategory.toLowerCase().includes(q),
    );
  }

  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return NextResponse.json({
    total,
    offset,
    limit,
    items: page,
  });
}
