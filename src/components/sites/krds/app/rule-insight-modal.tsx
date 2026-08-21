"use client";

import { useEffect, useState } from "react";
import type { RuleDef } from "@/lib/krds/types";

export interface AditusInsight {
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
}

export interface HtmlExample {
  label: string;
  target: string;
  code: string;
  pass?: string;
  preview?: string;
}

type Props = {
  rule: RuleDef | null;
  onClose: () => void;
};

type InsightResp = {
  code: string;
  items: AditusInsight[];
  htmlExample: HtmlExample | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  serious: "bg-red-50 text-red-700",
  moderate: "bg-primary/10 text-primary",
  minor: "bg-slate-100 text-slate-600",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 긴급",
  P1: "P1 중요",
  P2: "P2 일반",
  P3: "P3 낮음",
};

export function RuleInsightModal({ rule, onClose }: Props) {
  const [data, setData] = useState<InsightResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!rule) return;
    setLoading(true);
    setData(null);
    setShowCode(false);
    const u = new URL("/api/v1/rules", window.location.origin);
    u.searchParams.set("mode", "insight");
    u.searchParams.set("code", rule.code);
    u.searchParams.set("subcategory", rule.subcategory);
    u.searchParams.set("domain", rule.domain);
    fetch(u.toString())
      .then((r) => r.json())
      .then((j) => setData(j as InsightResp))
      .catch(() => setData({ code: rule.code, items: [], htmlExample: null }))
      .finally(() => setLoading(false));
  }, [rule]);

  if (!rule) return null;

  const insights = data?.items ?? [];
  const htmlEx = data?.htmlExample ?? null;
  const sev = SEVERITY_STYLES[rule.severityDefault] ?? SEVERITY_STYLES.minor;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${rule.code} 인사이트`}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {rule.category}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {rule.subcategory}
              </span>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${sev}`}>
                {rule.severityDefault}
              </span>
              {rule.priorityDefault && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {PRIORITY_LABELS[rule.priorityDefault] ?? rule.priorityDefault}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-bold leading-snug">{rule.title}</h3>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {rule.code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* ── 본문 (스크롤) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {rule.description}
          </p>

          {/* HTML 검사 대상 — 미리보기 우선 */}
          {htmlEx && (
            <section className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  검사 대상
                </span>
                <span className="text-sm font-semibold">{htmlEx.label}</span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{htmlEx.target}</p>

              {htmlEx.preview && (
                <div className="overflow-hidden rounded-xl border border-border bg-white">
                  <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      미리보기
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      파랑 = 준수 · 빨강 = 위반
                    </span>
                  </div>
                  <iframe
                    title={`${htmlEx.label} 미리보기`}
                    sandbox=""
                    srcDoc={htmlEx.preview}
                    className="h-56 w-full bg-white"
                  />
                </div>
              )}

              {htmlEx.pass && (
                <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-primary">
                  {htmlEx.pass}
                </p>
              )}

              {/* 코드 토글 */}
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showCode ? "▾ 코드 숨기기" : "▸ HTML 코드 보기"}
              </button>
              {showCode && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#0f172a] px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-200">
                  {htmlEx.code}
                </pre>
              )}
            </section>
          )}

          {/* KWCAG 인사이트 */}
          {insights.length > 0 && (
            <section className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  KWCAG 2.2
                </span>
                <span className="text-sm font-semibold">상세 기준</span>
              </div>
              {insights.map((ins) => (
                <article
                  key={ins.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      #{ins.id}
                    </span>
                    <h4 className="text-sm font-semibold">{ins.title}</h4>
                    {ins.isNew && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        신규
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    {ins.detailedDesc || ins.desc}
                  </p>
                  {ins.evaluation && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-primary">
                        평가 방법
                      </p>
                      <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                        {ins.evaluation}
                      </p>
                    </div>
                  )}
                  {(ins.badExample || ins.goodExample) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {ins.badExample && (
                        <div>
                          <p className="text-xs font-bold text-red-700">
                            나쁜 예
                          </p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-red-900">
                            {ins.badExample}
                          </pre>
                        </div>
                      )}
                      {ins.goodExample && (
                        <div>
                          <p className="text-xs font-bold text-primary">
                            좋은 예
                          </p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-primary/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-primary">
                            {ins.goodExample}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                  {ins.codeSnippet && (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-[11px]">
                      {ins.codeSnippet}
                    </pre>
                  )}
                </article>
              ))}
            </section>
          )}

          {loading && (
            <p className="mt-6 text-sm text-muted-foreground">
              인사이트 불러오는 중…
            </p>
          )}
          {!loading && !htmlEx && insights.length === 0 && (
            <p className="mt-6 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              연결된 상세 인사이트가 없습니다. (매핑 보강 필요)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
