/**
 * SSE 실시간 진행 이벤트 저장소 (메모리 맵)
 *
 * 분석 잡은 async로 백그라운드 실행되므로, 진행 상황을 이벤트 버퍼에 기록하고
 * GET /api/v1/analyses/:id/events (SSE) 로 스트리밍한다.
 * 서버 재시작 시 소실 허용(현재 진행 중 잡만 해당).
 */
import { newId } from "./password";

export type AnalysisEventType =
  | "job.queued"
  | "job.running"
  | "inspect.static"
  | "inspect.render"
  | "inspect.axe"
  | "inspect.crawl"
  | "inspect.hits"
  | "score.rules"
  | "score.domains"
  | "report.build"
  | "report.done"
  | "job.completed"
  | "job.failed"
  | "job.cancelled";

export interface AnalysisEvent {
  id: string;
  jobId: string;
  type: AnalysisEventType;
  ts: number; // epoch ms
  progress?: number;
  message?: string;
  data?: Record<string, unknown>;
}

/** jobId → 이벤트 로그 (최근 200개) */
const eventLog = new Map<string, AnalysisEvent[]>();
/** jobId → SSE 구독자 set */
const subscribers = new Map<string, Set<(e: AnalysisEvent) => void>>();

const MAX_EVENTS = 200;

export function pushAnalysisEvent(
  jobId: string,
  type: AnalysisEventType,
  opts: { progress?: number; message?: string; data?: Record<string, unknown> } = {},
): void {
  const ev: AnalysisEvent = {
    id: newId("evt"),
    jobId,
    type,
    ts: Date.now(),
    progress: opts.progress,
    message: opts.message,
    data: opts.data,
  };
  const log = eventLog.get(jobId) ?? [];
  log.push(ev);
  if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
  eventLog.set(jobId, log);

  const subs = subscribers.get(jobId);
  if (subs) {
    for (const fn of [...subs]) {
      try {
        fn(ev);
      } catch {
        /* subscriber 오류 무시 */
      }
    }
  }
}

export function getAnalysisEvents(jobId: string, afterId?: string): AnalysisEvent[] {
  const log = eventLog.get(jobId) ?? [];
  if (!afterId) return log;
  const idx = log.findIndex((e) => e.id === afterId);
  return idx < 0 ? log : log.slice(idx + 1);
}

export function subscribeAnalysisEvents(
  jobId: string,
  fn: (e: AnalysisEvent) => void,
): () => void {
  let set = subscribers.get(jobId);
  if (!set) {
    set = new Set();
    subscribers.set(jobId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) subscribers.delete(jobId);
  };
}

/** 진행 단계 로그를 쉽게 쌓는 헬퍼 — 최소 250ms 간격으로 스로틀 (진행률 자연스럽게) */
const lastProgressAt = new Map<string, number>();
export function analysisProgress(
  jobId: string,
  step: string,
  progress: number,
  detail?: string,
): void {
  const now = Date.now();
  const last = lastProgressAt.get(jobId) || 0;
  // 마지막 이벤트 후 250ms 미만이면 스킵 — SSE 폭주 방지 + 진행률 급등 방지
  // 단, 100% 완료 이벤트는 항상 통과
  if (progress < 100 && now - last < 250) return;
  lastProgressAt.set(jobId, now);
  pushAnalysisEvent(jobId, "job.running", {
    progress,
    message: `${step}${detail ? ` — ${detail}` : ""}`,
  });
}
