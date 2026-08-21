import { mutateStore, readStore } from "./store";
import { newId } from "./password";
import { runAnalysisJob } from "./analyzer";
import type { AnalysisJob, User } from "./types";

export class AnalysisError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new AnalysisError("대상 URL이 필요합니다.", 400);
  let url: URL;
  try {
    url = new URL(t.includes("://") ? t : `https://${t}`);
  } catch {
    throw new AnalysisError("올바른 URL 형식이 아닙니다.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AnalysisError("http/https URL만 허용됩니다.", 400);
  }
  return url.toString();
}

function listProjection(job: AnalysisJob): AnalysisJob {
  if (!job.report) return job;
  return {
    ...job,
    report: {
      ...job.report,
      findings: [],
      categoryBreakdown: [],
      sections: [],
      roadmap: [],
    },
  };
}

export function listAnalysesForUser(user: User): AnalysisJob[] {
  const store = readStore();
  const rows =
    user.role === "admin"
      ? store.analyses
      : store.analyses.filter((a: any) => a.userId === user.id);
  return rows
    .slice()
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
    .map(listProjection);
}

export function getAnalysisForUser(
  user: User,
  id: string,
  _opts?: { includeRuleResults?: boolean },
): AnalysisJob {
  const store = readStore();
  const job = store.analyses.find((a: any) => a.id === id);
  if (!job) throw new AnalysisError("분석을 찾을 수 없습니다.", 404);
  if (user.role !== "admin" && job.userId !== user.id) {
    throw new AnalysisError("접근 권한이 없습니다.", 403);
  }
  return job;
}

export function createAnalysis(
  user: User,
  input: {
    targetUrl: string;
    title?: string;
    includeKrds?: boolean;
    includeKwcag?: boolean;
    includeSecurity?: boolean;
    includeResponsive?: boolean;
    includeCatalogSim?: boolean;
    inspectMode?: "static" | "render" | "render+axe";
    maxPages?: number;
    maxDepth?: number;
    axes?: AnalysisJob["options"]["axes"];
    a11yProfile?: AnalysisJob["options"]["a11yProfile"];
  },
): AnalysisJob {
  const store = readStore();
  const monthKey = new Date().toISOString().slice(0, 7);
  const used = store.analyses.filter(
    (a) => a.userId === user.id && a.createdAt.startsWith(monthKey),
  ).length;
  const limit = user.plan === "free" ? 3 : user.plan === "standard" ? 100 : 200;
  if (used >= limit) {
    throw new AnalysisError(
      `이번 달 분석 한도(${limit})를 모두 사용했습니다. 요금제를 업그레이드하세요.`,
      402,
    );
  }

  const targetUrl = normalizeUrl(input.targetUrl);
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id: newId("anl"),
    userId: user.id,
    targetUrl,
    title: input.title?.trim() || new URL(targetUrl).hostname,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
    options: {
      includeKrds: input.includeKrds !== false,
      includeKwcag: input.includeKwcag !== false,
      includeSecurity: input.includeSecurity !== false,
      includeResponsive: input.includeResponsive !== false,
      axes: input.axes,
      includeCatalogSim: input.includeCatalogSim === true,
      inspectMode: input.inspectMode || "render+axe",
      maxPages: input.maxPages ?? 8,
      maxDepth: input.maxDepth ?? 3,
      a11yProfile: input.a11yProfile,
    },
  };

  mutateStore((s) => {
    s.analyses.unshift(job);
  });

  void runAnalysisJob(job.id, (mutator) => {
    mutateStore((s) => {
      const row = s.analyses.find((a: any) => a.id === job.id);
      if (row) mutator(row);
    });
  });

  return job;
}

export function cancelAnalysis(user: User, id: string): AnalysisJob {
  return mutateStore((s) => {
    const job = s.analyses.find((a: any) => a.id === id);
    if (!job) throw new AnalysisError("분석을 찾을 수 없습니다.", 404);
    if (user.role !== "admin" && job.userId !== user.id) {
      throw new AnalysisError("접근 권한이 없습니다.", 403);
    }
    if (job.status === "completed" || job.status === "failed") {
      throw new AnalysisError("이미 종료된 분석입니다.", 409);
    }
    job.status = "cancelled";
    job.updatedAt = new Date().toISOString();
    return job;
  });
}
