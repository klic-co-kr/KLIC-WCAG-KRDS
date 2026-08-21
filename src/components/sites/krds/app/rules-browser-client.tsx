"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RuleDef, RuleDomain } from "@/lib/krds/types";
import { RADIUS_ORDER, radiusBadge, radiusLetter } from "@/lib/krds/kq";
import { RuleInsightModal } from "./rule-insight-modal";

type RadiusAxis = {
  domain: RuleDomain;
  letter: string;
  code: string;
  name: string;
  label: string;
  source: string;
  weight: number;
  count: number;
};

type Summary = {
  taxonomy?: string;
  brand?: string;
  expand?: string;
  liveCounts?: Record<string, number>;
  radiusAxes?: RadiusAxis[];
  honesty?: string;
};

type Cat = {
  domain: RuleDomain;
  category: string;
  subcategory: string;
  count: number;
};

const DOMAIN_TABS: { id: "" | RuleDomain; label: string }[] = [
  { id: "", label: "전체" },
  ...RADIUS_ORDER.map((d) => ({
    id: d as "" | RuleDomain,
    label: radiusLetter(d),
  })),
];

export function RulesBrowserClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [domain, setDomain] = useState<"" | RuleDomain>("");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<RuleDef[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [insightRule, setInsightRule] = useState<RuleDef | null>(null);
  const limit = 40;

  const loadSummary = useCallback(async () => {
    const r = await fetch("/api/v1/rules?mode=summary");
    setSummary((await r.json()) as Summary);
  }, []);

  const loadCats = useCallback(async () => {
    const u = new URL("/api/v1/rules", window.location.origin);
    u.searchParams.set("mode", "categories");
    if (domain) u.searchParams.set("domain", domain);
    const r = await fetch(u);
    const j = (await r.json()) as { items: Cat[] };
    setCats(j.items ?? []);
  }, [domain]);

  const loadRules = useCallback(async () => {
    const u = new URL("/api/v1/rules", window.location.origin);
    u.searchParams.set("mode", "list");
    if (domain) u.searchParams.set("domain", domain);
    if (q.trim()) u.searchParams.set("q", q.trim());
    if (catFilter) {
      const [category, subcategory] = catFilter.split("||");
      if (category) u.searchParams.set("category", category);
      if (subcategory) u.searchParams.set("subcategory", subcategory);
    }
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const r = await fetch(u.toString());
    const j = (await r.json()) as { items: RuleDef[]; total: number };
    setItems(j.items ?? []);
    setTotal(j.total ?? 0);
  }, [domain, q, offset, catFilter]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setOffset(0);
    setCatFilter(null);
  }, [domain, q]);

  useEffect(() => {
    void loadCats();
  }, [loadCats]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const axes = summary?.radiusAxes ?? [];

  /** Group category tree: letter → category → subcats */
  const tree = useMemo(() => {
    const byDomain = new Map<
      RuleDomain,
      Map<string, { subcategory: string; count: number }[]>
    >();
    for (const c of cats) {
      if (!byDomain.has(c.domain)) byDomain.set(c.domain, new Map());
      const cm = byDomain.get(c.domain)!;
      if (!cm.has(c.category)) cm.set(c.category, []);
      cm.get(c.category)!.push({ subcategory: c.subcategory, count: c.count });
    }
    const order = domain ? [domain] : RADIUS_ORDER;
    return order
      .filter((d) => byDomain.has(d))
      .map((d) => ({
        domain: d,
        letter: radiusLetter(d),
        badge: radiusBadge(d),
        categories: [...(byDomain.get(d)?.entries() ?? [])].map(
          ([category, subs]) => ({
            category,
            subs: subs.sort((a, b) => a.subcategory.localeCompare(b.subcategory, "ko")),
          }),
        ),
      }));
  }, [cats, domain]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            RADIUS CATALOG
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            RADIUS 규칙 카탈로그
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              총 {total} 규칙
            </span>
            <span className="text-sm text-muted-foreground">
              {summary?.expand ??
                "R·A·D·I·U·S — D=Design(kq_d) · I=Interface(kq_i) · U=User flow(kq_u)"}
            </span>
          </div>
          {summary?.honesty && (
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{summary.honesty}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/dashboard" />}>
            대시보드
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            랜딩
          </Button>
        </div>
      </div>

      {axes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {axes.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => setDomain(d.domain)}
              className={`rounded-2xl border p-4 text-left ${
                domain === d.domain
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <p className="text-lg font-bold text-primary">{d.letter}</p>
              <p className="text-xs font-semibold">{d.name}</p>
              <p className="mt-1 text-2xl font-bold">{d.count}</p>
              <p className="text-[10px] text-muted-foreground">
                {d.source === "krds-mcp" ? "MCP 공식" : "KLIC 확장"}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {DOMAIN_TABS.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            onClick={() => setDomain(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              domain === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="코드·제목·설명 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="self-center text-xs text-muted-foreground">
          {total}건 중 {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)}
        </p>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">카테고리 트리 (RADIUS)</h2>
          {catFilter && (
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setCatFilter(null)}
            >
              필터 해제
            </button>
          )}
        </div>
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3">
          {tree.length === 0 && (
            <p className="text-xs text-muted-foreground">카테고리 없음</p>
          )}
          {tree.map((node) => (
            <div key={node.domain}>
              <p className="text-xs font-bold text-primary">{node.badge}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 pl-2">
                {node.categories.map((cat) =>
                  cat.subs.map((sub) => {
                    const key = `${cat.category}||${sub.subcategory}`;
                    const active =
                      catFilter === key && (!domain || domain === node.domain);
                    return (
                      <button
                        key={`${node.domain}-${key}`}
                        type="button"
                        onClick={() => {
                          setDomain(node.domain);
                          setCatFilter(key);
                          setOffset(0);
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <span className="font-bold opacity-80">{node.letter}/</span>
                        {cat.category !== sub.subcategory
                          ? `${cat.category} › ${sub.subcategory}`
                          : sub.subcategory}
                        <span className="opacity-70"> · {sub.count}</span>
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <button
              type="button"
              onClick={() => setInsightRule(r)}
              className="block w-full text-left"
              aria-label={`${r.code} 인사이트 보기`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                  {radiusLetter(r.domain)}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                  {radiusBadge(r.domain)}
                </span>
                {r.source === "krds-mcp" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                    MCP
                  </span>
                )}
                <span className="font-mono">{r.code}</span>
                <span>
                  {r.category} · {r.subcategory}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {r.severityDefault}
                </span>
                <span className="ml-auto text-[10px] text-primary">
                  인사이트 보기 →
                </span>
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {r.description}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <RuleInsightModal rule={insightRule} onClose={() => setInsightRule(null)} />

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={offset <= 0}
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
        >
          이전
        </Button>
        <Button
          variant="outline"
          disabled={offset + limit >= total}
          onClick={() => setOffset((o) => o + limit)}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
