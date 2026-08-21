"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { AnalysisJob, PublicUser, RuleDomain } from "@/lib/krds/types";
import { KQ_AXES, KQ_META, RADIUS_ORDER } from "@/lib/krds/kq";

type MeResponse = {
  user: PublicUser;
  usage: { month: string; used: number; limit: number };
};

type RadiusAxisInfo = {
  domain: RuleDomain;
  letter: string;
  code: string;
  name: string;
  label: string;
  source: "krds-mcp" | "klic-ext";
  weight: number;
  count: number;
};

type CatalogSummary = {
  liveCounts: Record<string, number>;
  radiusAxes?: RadiusAxisInfo[];
  domains: string[] | { id: string; label: string; claimed: number; actual: number; description: string }[];
};

const statusLabel: Record<string, string> = {
  queued: "대기",
  running: "분석 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소",
};

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  queued: { label: "대기", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  running: { label: "분석 중", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  completed: { label: "완료", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  failed: { label: "실패", cls: "bg-red-100 text-red-800", dot: "bg-red-500" },
  cancelled: { label: "취소", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const DOMAIN_OPTS: { key: RuleDomain; label: string }[] = [
  { key: "kq_r", label: "R Responsive" },
  { key: "kq_a", label: "A Accessibility" },
  { key: "kq_d", label: "D Design(MCP)" },
  { key: "kq_i", label: "I Interface(MCP)" },
  { key: "kq_u", label: "U User flow(MCP)" },
  { key: "kq_s", label: "S Security" },
];

/** 축 위반 숫자 칩 — 0이면 회색, 많을수록 강조 */
function AxisFailChip({ letter, count }: { letter: string; count: number }) {
  const cls =
    count === 0
      ? "bg-slate-100 text-slate-400"
      : count <= 5
        ? "bg-primary/10 text-primary"
        : count <= 15
          ? "bg-red-50 text-red-700"
          : "bg-red-100 text-red-800";
  return (
    <span
      title={`${letter}축 위반 ${count}건`}
      className={`inline-flex min-w-[2rem] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${cls}`}
    >
      {letter} {count}
    </span>
  );
}

/** 점수 게이지 바 */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<AnalysisJob[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 10;
  const [catalog, setCatalog] = useState<CatalogSummary | null>(null);
  const [url, setUrl] = useState("https://www.gov.kr");
  const [domains, setDomains] = useState<Record<RuleDomain, boolean>>({
    kq_r: true,
    kq_a: true,
    kq_d: true,
    kq_i: true,
    kq_u: true,
    kq_s: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enabledCount = useMemo(
    () => Object.values(domains).filter(Boolean).length,
    [domains],
  );

  const load = useCallback(async () => {
    const meRes = await fetch("/api/v1/me");
    if (meRes.status === 401) {
      router.replace("/login");
      return;
    }
    setMe((await meRes.json()) as MeResponse);
    const listRes = await fetch("/api/v1/analyses");
    const listJson = (await listRes.json()) as { items: AnalysisJob[] };
    setItems(listJson.items ?? []);
  }, [router]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    void fetch("/api/v1/rules?mode=summary")
      .then((r) => r.json())
      .then((j) => setCatalog(j as CatalogSummary))
      .catch(() => undefined);
  }, []);

  async function startAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (enabledCount === 0) {
      setError("최소 1개 축을 선택하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: url,
          // legacy flags (MCP bundle V/U/F)
          includeKrds: domains.kq_d || domains.kq_i || domains.kq_u,
          includeKwcag: domains.kq_a,
          includeSecurity: domains.kq_s,
          includeResponsive: domains.kq_r,
          axes: domains,
        }),
      });
      const json = (await res.json()) as { error?: string; item?: AnalysisJob };
      if (!res.ok) throw new Error(json.error || "생성 실패");
      await load();
      if (json.item) router.push(`/dashboard/analyses/${json.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground">
        로딩 중…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* 브랜드 마크 */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-sm">
            R
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              KLIC RADIUS
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              RADIUS 6축
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {me.user.name} · {me.user.plan} · 이번 달 {me.usage.used}/{me.usage.limit}
            </p>
            <p className="mt-2 max-w-2xl rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <strong>판정 고지:</strong> S(Security) 헤더만 HTTP 실측. 나머지 RADIUS 축은
              시뮬 (참고용). 시뮬 점수를 감리 준수율로 쓰지 마세요.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/rules" />}>
            규칙 카탈로그
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            랜딩
          </Button>
          <Button variant="ghost" onClick={() => void logout()}>
            로그아웃
          </Button>
        </div>
      </div>

      {/* KPI 스트립 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">총 분석</p>
          <p className="mt-1 text-2xl font-bold">{items.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {items.filter((i) => i.status === "completed").length}건 완료
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">이번 달 사용량</p>
          <div className="mt-1 flex items-baseline gap-1">
            <p className="text-2xl font-bold">
              {me.usage.used}
              <span className="text-sm font-medium text-muted-foreground">/{me.usage.limit}</span>
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, (me.usage.used / Math.max(1, me.usage.limit)) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">평균 점수</p>
          <p className="mt-1 text-2xl font-bold">
            {items.filter((i) => i.report?.overallScore != null).length
              ? Math.round(
                  items
                    .filter((i) => i.report?.overallScore != null)
                    .reduce((s, i) => s + (i.report?.overallScore ?? 0), 0) /
                    items.filter((i) => i.report?.overallScore != null).length,
                )
              : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">전체 분석 평균</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">실패 분석</p>
          <p className="mt-1 text-2xl font-bold text-red-700">
            {items.filter((i) => i.status === "failed").length}
          </p>
          <p className="text-[11px] text-muted-foreground">실패 {items.filter((i) => i.status === "failed").length}건</p>
        </div>
      </section>

      {/* RADIUS 6축 카탈로그 요약 — radiusAxes 기반 (domains는 문자열 배열) */}
      {catalog && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(catalog.radiusAxes ?? []).map((d) => (
            <div
              key={d.domain}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {d.letter}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    d.source === "krds-mcp"
                      ? "bg-primary/10 text-primary"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d.source === "krds-mcp" ? "MCP" : "확장"}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">{d.label}</p>
              <p className="text-[11px] text-muted-foreground">{d.name}</p>
              <p className="mt-1.5 text-xl font-bold">
                {d.count}
                <span className="ml-1 text-xs font-medium text-muted-foreground">규칙</span>
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">새 분석 시작</h2>
        <form className="space-y-4" onSubmit={startAnalysis}>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.go.kr"
            required
          />
          <div className="flex flex-wrap gap-3">
            {DOMAIN_OPTS.map((d) => (
              <label
                key={d.key}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={domains[d.key]}
                  onChange={(e) =>
                    setDomains((prev) => ({ ...prev, [d.key]: e.target.checked }))
                  }
                />
                {d.label}
              </label>
            ))}
          </div>
          <Button type="submit" className="h-11 px-6" disabled={busy}>
            {busy ? "요청 중…" : "도메인 분리 분석 시작"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          RADIUS: D/I/U=MCP 공식 · R/A/S=확장. S 헤더 실측. 엔진 klic-radius-v1.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">최근 분석</h2>
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm sm:w-64"
              placeholder="제목·URL·축 검색"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        {(() => {
          // 검색 필터 + 페이지네이션
          const query = q.trim().toLowerCase();
          const filtered = query
            ? items.filter((it) => {
                const hay = [
                  it.title,
                  it.targetUrl,
                  it.status,
                  it.report?.domainScores?.map((d) => `${d.axisCode || d.domain}`).join(" "),
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return hay.includes(query);
              })
            : items;
          const pages = Math.max(1, Math.ceil(filtered.length / perPage));
          const cur = Math.min(page, pages - 1);
          const pageItems = filtered.slice(cur * perPage, cur * perPage + perPage);
          return (
            <>
              {filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {query ? `"${q}" 검색 결과가 없습니다.` : "아직 분석이 없습니다."}
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {pageItems.map((item) => {
                    const scores = item.report?.domainScores ?? [];
                    const score = item.report?.overallScore;
                    const smeta = STATUS_META[item.status] ?? {
                      label: item.status,
                      cls: "bg-slate-100 text-slate-600",
                      dot: "bg-slate-400",
                    };
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/dashboard/analyses/${item.id}`}
                          className="group block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold group-hover:text-primary">
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.targetUrl}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${smeta.cls}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${smeta.dot}`} />
                                {smeta.label}
                                {item.status === "running" || item.status === "queued"
                                  ? ` ${item.progress}%`
                                  : ""}
                              </span>
                              {score != null && (
                                <span className="text-lg font-bold tabular-nums text-primary">
                                  {score}
                                  <span className="text-xs font-semibold">점</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {scores.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {scores.map((d) => (
                                <AxisFailChip
                                  key={d.domain}
                                  letter={d.axisCode || d.domain.replace("kq_", "").toUpperCase()}
                                  count={d.failed}
                                />
                              ))}
                            </div>
                          )}
                          {score != null && <ScoreBar score={score} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filtered.length > perPage && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length}건 중 {cur * perPage + 1}–
                    {Math.min((cur + 1) * perPage, filtered.length)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={cur <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      이전
                    </button>
                    <span className="self-center text-xs text-muted-foreground">
                      {cur + 1} / {pages}
                    </span>
                    <button
                      type="button"
                      disabled={cur >= pages - 1}
                      onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
}
