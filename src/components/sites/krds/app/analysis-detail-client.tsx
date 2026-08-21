"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AnalysisJob, Finding, RuleDomain } from "@/lib/krds/types";
import { RADIUS_ORDER, radiusBadge, radiusLetter } from "@/lib/krds/kq";
import { SitemapGraph } from "./sitemap-graph";
import type { AnalysisEvent } from "@/lib/krds/events";

const sevColor: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  serious: "bg-red-50 text-red-700",
  moderate: "bg-primary/10 text-primary",
  minor: "bg-slate-100 text-slate-700",
};

/** 진행 단계 트레일 (진행률 구간 기준) */
const STEPS: { key: string; label: string; min: number }[] = [
  { key: "connect", label: "대상 접속", min: 20 },
  { key: "crawl", label: "페이지 크롤", min: 55 },
  { key: "rules", label: "규칙 평가", min: 70 },
  { key: "report", label: "리포트 구성", min: 92 },
  { key: "done", label: "완료", min: 100 },
];

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  queued: { label: "대기", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  running: { label: "분석 중", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  completed: { label: "완료", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  failed: { label: "실패", cls: "bg-red-100 text-red-800", dot: "bg-red-500" },
  cancelled: { label: "취소", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

/** 진행 단계 트레일 — 마법사(위저드) 스타일: 원형 번호 스텝 + 연결선 + 현재 단계 상세 */
function WizardStepper({
  progress,
  running,
  events,
}: {
  progress: number;
  running: boolean;
  events: AnalysisEvent[];
}) {
  const lastMsg = events[events.length - 1]?.message;
  // 현재 활성 단계 (progress가 아직 도달 못한 첫 단계)
  const activeIdx = STEPS.findIndex((s) => progress < s.min);
  const activeStep = activeIdx === -1 ? STEPS[STEPS.length - 1] : STEPS[activeIdx];

  return (
    <div className="w-full max-w-xl rounded-xl border border-border bg-background p-4">
      {/* 스텝 인디케이터 — 원형 번호 + 연결선 */}
      <ol className="flex items-start justify-center">
        {STEPS.map((s, i) => {
          const done = progress >= s.min;
          const active = running && progress < s.min && progress >= (STEPS[i - 1]?.min ?? 0);
          return (
            <li key={s.key} className="relative flex flex-1 flex-col items-center gap-1.5">
              {i > 0 && (
                <span
                  className={`absolute left-[-50%] top-[15px] h-0.5 w-full ${
                    done || active ? "bg-primary" : "bg-slate-200"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/10 text-primary ring-2 ring-primary"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  done ? "text-primary" : active ? "text-foreground" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 현재 단계 상세 — 지금 하고 있는 일 (고정 높이로 점프 방지) */}
      {running ? (
        <div className="mt-3 flex h-16 items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-primary">
              {activeStep.label}
              <span className="ml-1 text-xs font-medium text-primary/70">단계 진행 중</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {lastMsg ?? "작업 준비 중…"}
            </p>
          </div>
          <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
            {progress}%
          </span>
        </div>
      ) : (
        <div className="mt-3 flex h-16 items-center justify-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <span className="shrink-0 text-lg">✓</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-primary">분석 완료</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {lastMsg ?? "리포트가 생성되었습니다."}
            </p>
          </div>
          <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
            {progress}%
          </span>
        </div>
      )}
    </div>
  );
}

/** 이벤트 로그 타임라인 — 단계별 색 점 + 진행률 + 메시지 */
function EventTimeline({ events }: { events: AnalysisEvent[] }) {
  const tone = (type: string): string => {
    if (type.startsWith("inspect.")) return "bg-primary";
    if (type.startsWith("score.")) return "bg-slate-400";
    if (type.startsWith("report.")) return "bg-primary/60";
    if (type === "job.failed") return "bg-red-500";
    return "bg-slate-300";
  };
  return (
    <ul className="h-44 space-y-0 overflow-y-auto">
      {events.map((ev, i) => (
        <li key={ev.id} className="relative flex items-start gap-2.5 pb-2">
          {i < events.length - 1 && (
            <span className="absolute left-[3px] top-3 h-full w-px bg-slate-200" />
          )}
          <span
            className={`relative mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone(ev.type)} ${
              i === events.length - 1 ? "animate-pulse" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {new Date(ev.ts).toLocaleTimeString("ko-KR", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              {typeof ev.progress === "number" && (
                <span className="rounded bg-primary/10 px-1 font-mono text-[10px] font-bold tabular-nums text-primary">
                  {ev.progress}%
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-foreground/80">{ev.message ?? ev.type}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 단계별 스텝 로그 — 마법사 완료 스텝 요약 (이벤트를 STEPS 구간으로 그룹핑) */
function StepLog({ events }: { events: AnalysisEvent[] }) {
  const byStep = STEPS.map((s, i) => {
    const min = STEPS[i - 1]?.min ?? 0;
    const max = s.min;
    const inStep = events.filter((ev) => {
      const p = typeof ev.progress === "number" ? ev.progress : 0;
      return p > min && p <= max;
    });
    return { step: s, events: inStep };
  }).filter((g) => g.events.length > 0);

  if (byStep.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {byStep.map(({ step, events: evs }) => {
        const last = evs[evs.length - 1];
        const count = evs.length;
        return (
          <li key={step.key} className="flex items-center gap-2.5 rounded-lg bg-background/60 px-2.5 py-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-foreground/80">{step.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {last?.message ?? ""}
                {count > 1 ? ` · ${count}건` : ""}
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-primary">
              {last && typeof last.progress === "number" ? `${last.progress}%` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const TABS: { id: "all" | RuleDomain | "sections" | "roadmap" | "categories"; label: string }[] = [
  { id: "all", label: "전체 이슈" },
  { id: "kq_r", label: "R" },
  { id: "kq_a", label: "A" },
  { id: "kq_d", label: "D" },
  { id: "kq_i", label: "I" },
  { id: "kq_u", label: "U" },
  { id: "kq_s", label: "S" },
  { id: "categories", label: "카테고리" },
  { id: "sections", label: "섹션" },
  { id: "roadmap", label: "로드맵" },
];

export function AnalysisDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [sev, setSev] = useState<string>("all");
  const [events, setEvents] = useState<AnalysisEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/analyses/${id}`);
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const json = (await res.json()) as { item?: AnalysisJob; error?: string };
    if (!res.ok) {
      setError(json.error || "조회 실패");
      return;
    }
    setItem(json.item ?? null);
  }, [id, router]);

  // SSE 실시간 진행 스트림
  useEffect(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`/api/v1/analyses/${id}/events`);
    esRef.current = es;
    const finish = (status: "completed" | "failed" | "cancelled") => {
      es.close();
      esRef.current = null;
      void load();
      // 종료 상태를 바로 반영 (100% 스턱 방지 — status가 running에 갇히지 않게)
      setItem((prev) => (prev ? { ...prev, status, progress: 100 } : prev));
    };
    es.addEventListener("analysis.progress", (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as AnalysisEvent;
        setEvents((prev) => {
          const next = [...prev, ev];
          return next.length > 50 ? next.slice(next.length - 50) : next;
        });
        // SSE 이벤트의 progress를 직접 반영 — load() 폴링으로 진행률 급등 방지
        // (load()는 완료 시점에만 호출)
        if (typeof ev.progress === "number") {
          const p = ev.progress as number;
          setItem((prev) => (prev ? { ...prev, progress: p } : prev));
        }
        // 종료 이벤트를 받았으면 즉시 done 처리 (서버 done과 이중 안전)
        if (ev.type === "job.completed") finish("completed");
        else if (ev.type === "job.failed") finish("failed");
        else if (ev.type === "job.cancelled") finish("cancelled");
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("done", (e) => {
      let status: "completed" | "failed" | "cancelled" = "completed";
      try {
        const d = JSON.parse((e as MessageEvent).data) as { status?: string };
        if (d.status === "failed") status = "failed";
        else if (d.status === "cancelled") status = "cancelled";
      } catch {
        /* ignore */
      }
      finish(status);
    });
    es.addEventListener("error", () => {
      // 재연결은 브라우저가 자동 — 잡이 끝났으면 닫기
      if (item?.status === "completed" || item?.status === "failed") {
        es.close();
        esRef.current = null;
      }
    });
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [id, load, item?.status]);

  // 초기 로드
  useEffect(() => {
    void load();
  }, [load]);

  const findings: Finding[] = useMemo(() => {
    const all = item?.report?.findings ?? [];
    return all.filter((f) => {
      if (tab.startsWith("kq_")) {
        if (f.domain !== tab) return false;
      }
      if (sev !== "all" && f.severity !== sev) return false;
      return true;
    });
  }, [item, tab, sev]);

  async function cancel() {
    await fetch(`/api/v1/analyses/${id}`, { method: "DELETE" });
    await load();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary">
          ← 대시보드
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">
        로딩 중…
      </div>
    );
  }

  const report = item.report;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xs text-primary hover:underline">
            ← 대시보드
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{item.title}</h1>
          <p className="break-all text-sm text-muted-foreground">{item.targetUrl}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(item.status === "queued" || item.status === "running") && (
            <Button variant="outline" onClick={() => void cancel()}>
              취소
            </Button>
          )}
          {report && (
            <>
              <Button
                variant="default"
                render={
                  <a
                    href={`/dashboard/analyses/${item.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                리포트 보기
              </Button>
              <Button
                variant="outline"
                render={
                  <a href={`/api/v1/analyses/${item.id}/report?format=xlsx`} />
                }
              >
                Excel
              </Button>
              <Button
                variant="outline"
                render={
                  <a href={`/api/v1/analyses/${item.id}/report?format=pdf`} />
                }
              >
                PDF
              </Button>
              <Button
                variant="outline"
                render={
                  <a href={`/api/v1/analyses/${item.id}/report?format=html`} />
                }
              >
                HTML
              </Button>
              <Button
                variant="outline"
                render={
                  <a href={`/api/v1/analyses/${item.id}/report?format=csv`} />
                }
              >
                CSV
              </Button>
              <Button variant="outline" render={<Link href="/rules" />}>
                규칙 카탈로그
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  STATUS_META[item.status]?.cls ?? "bg-slate-100 text-slate-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    STATUS_META[item.status]?.dot ?? "bg-slate-400"
                  } ${item.status === "running" ? "animate-pulse" : ""}`}
                />
                {STATUS_META[item.status]?.label ?? item.status}
              </span>
              <span className="text-sm font-semibold tabular-nums">{item.progress}%</span>
              {item.status === "running" && (
                <span className="text-xs text-muted-foreground">· SSE 실시간</span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              체계: RADIUS · MCP {item.options.includeKrds !== false ? "ON" : "OFF"} ·
              A11y {item.options.includeKwcag !== false ? "ON" : "OFF"} · Sec{" "}
              {item.options.includeSecurity !== false ? "ON" : "OFF"} · RWD{" "}
              {item.options.includeResponsive !== false ? "ON" : "OFF"}
            </p>
            {report?.methodNote && (
              <p className="mt-2 max-w-xl rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs text-primary">
                {report.methodNote}
                {report.measuredAxes?.length
                  ? ` · 실측 ${report.measuredAxes.join(",")}`
                  : ""}
              </p>
            )}
          </div>
          {report && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">종합 점수 (참고·시뮬포함)</p>
              <p className="text-4xl font-bold text-primary">{report.overallScore}</p>
              <p className="text-xs text-muted-foreground">
                평가 {report.evaluatedRuleCount}/{report.totalCatalogRules} · 위반{" "}
                {report.failCount}
              </p>
            </div>
          )}
        </div>
        {/* 마법사 위저드 스텝 — flex 컬럼 밖, 카드 전체 폭 + 중앙 정렬 */}
        <div className="mt-4 flex justify-center">
          <WizardStepper
            progress={item.progress}
            running={item.status === "running"}
            events={events}
          />
        </div>
        {(item.status === "queued" || item.status === "running") && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                item.status === "queued" ? "bg-slate-300" : "bg-primary"
              }`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {report && (
          <p className="mt-4 text-sm text-muted-foreground">{report.summary}</p>
        )}

        {/* 실시간 진행 로그 (SSE) — 타임라인 UI */}
        {(item.status === "queued" || item.status === "running") && events.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              실시간 분석 진행 중
            </p>
            <EventTimeline events={events} />
          </div>
        )}
        {/* 완료/실패 후 단계별 실행 로그 접이식 요약 (마법사 스텝 로그) */}
        {(item.status === "completed" || item.status === "failed" || item.status === "cancelled") &&
          events.length > 0 && (
            <details className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                실행 로그 ({events.length}건)
              </summary>
              <div className="mt-2">
                <StepLog events={events} />
              </div>
            </details>
          )}
      </div>

      {report && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.domainScores.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => setTab(d.domain)}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-primary">
                  {d.axisCode || d.label}
                </p>
                <span
                  className={
                    d.method === "measured"
                      ? "rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                      : "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                  }
                >
                  {d.method === "measured" ? "실측" : "시뮬"}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold">{d.score}</p>
              <p className="text-xs text-muted-foreground">
                위반 {d.failed} · 통과 {d.passed}
              </p>
            </button>
          ))}
        </section>
      )}

      {/* 사이트 연계도 — 크롤된 페이지 관계도 */}
      {report?.inspect?.sitemap && (
        <SitemapGraph sitemap={report.inspect.sitemap} />
      )}

      {/* A축 실측 패키지 — 시나리오 4카드 + KWCAG */}
      {report?.inspect?.a11y && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              접근성 실측 패키지{" "}
              <span className="text-xs font-normal text-muted-foreground">
                A · KWCAG {report.inspect.a11y.kwcagMapVersion}
              </span>
            </h2>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              실측
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.inspect.a11y.scenarios.map((s) => {
              const col =
                s.score >= 80 ? "text-primary" : s.score >= 55 ? "text-slate-700" : "text-red-700";
              const method =
                s.method === "measured" ? "실측" : s.method === "heuristic" ? "휴리스틱" : "수동권장";
              return (
                <div key={s.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground">{s.id}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        s.method === "measured"
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {method}
                    </span>
                  </div>
                  <p className={`mt-1 text-3xl font-bold ${col}`}>
                    {s.score}
                    <span className="text-xs font-semibold">점</span>
                  </p>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">블로커 {s.blockers}건</p>
                  {s.manualHints.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-[11px] text-slate-500">
                      {s.manualHints.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-muted-foreground">KWCAG 매핑</p>
              <p className="font-semibold">
                {report.inspect.a11y.kwcagMapped}/{report.inspect.a11y.kwcagMapped + report.inspect.a11y.kwcagUnmapped}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-muted-foreground">대비 위반</p>
              <p className="font-semibold">{report.inspect.a11y.contrastFails}</p>
            </div>
            {report.inspect.a11y.keyboard && (
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-muted-foreground">Tab 실측</p>
                <p className="font-semibold">
                  {report.inspect.a11y.keyboard.tabsSampled}회
                  {report.inspect.a11y.keyboard.trapSuspect ? " · 트랩 의심" : ""}
                </p>
              </div>
            )}
            {report.inspect.a11y.targetSize && (
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-muted-foreground">타깃&lt;24px</p>
                <p className="font-semibold">{report.inspect.a11y.targetSize.smallTargets}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {report.inspect.a11y.coverageNote}
          </p>
        </section>
      )}

      {report && (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {(tab === "all" ||
            tab.startsWith("kq_")) && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  발견 이슈 ({findings.length})
                </h2>
                <select
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={sev}
                  onChange={(e) => setSev(e.target.value)}
                >
                  <option value="all">전체 심각도</option>
                  <option value="critical">critical</option>
                  <option value="serious">serious</option>
                  <option value="moderate">moderate</option>
                  <option value="minor">minor</option>
                </select>
              </div>
              <ul className="space-y-3">
                {findings.slice(0, 100).map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sevColor[f.severity] ?? ""}`}
                      >
                        {f.severity}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {radiusLetter(f.domain)} · {f.category} · {f.subcategory}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {f.code}
                      </span>
                    </div>
                    <p className="mt-2 font-medium">{f.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-primary">권고: </span>
                      {f.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
              {findings.length > 100 && (
                <p className="text-xs text-muted-foreground">
                  상위 100건만 표시. 전체는 CSV export 사용.
                </p>
              )}
            </section>
          )}

          {tab === "categories" && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">카테고리별 상세</h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs">
                    <tr>
                      <th className="px-3 py-2">도메인</th>
                      <th className="px-3 py-2">카테고리</th>
                      <th className="px-3 py-2">서브</th>
                      <th className="px-3 py-2">통과</th>
                      <th className="px-3 py-2">위반</th>
                      <th className="px-3 py-2">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.categoryBreakdown.map((c) => (
                      <tr
                        key={`${c.domain}-${c.category}-${c.subcategory}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2 font-semibold text-primary">
                          {radiusBadge(c.domain)}
                        </td>
                        <td className="px-3 py-2">{c.category}</td>
                        <td className="px-3 py-2">{c.subcategory}</td>
                        <td className="px-3 py-2">{c.passed}</td>
                        <td className="px-3 py-2 font-medium text-red-700">
                          {c.failed}
                        </td>
                        <td className="px-3 py-2 font-semibold">{c.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "sections" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">전문 리포트 18섹션</h2>
              {report.sections.map((s) => (
                <article
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <p className="text-xs font-semibold text-primary">
                    {s.number}. {s.domain ?? ""}
                  </p>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </article>
              ))}
            </section>
          )}

          {tab === "roadmap" && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">개선 로드맵</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {report.roadmap.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <p className="font-semibold">{r.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.summary}</p>
                    <p className="mt-3 text-sm">
                      약 <strong>{r.estimatedWeeks}</strong>주 ·{" "}
                      <strong>{r.estimatedMm}</strong> MM
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      커버 이슈 {r.coversFindingIds.length}건
                    </p>
                    <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                      {r.focus.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
