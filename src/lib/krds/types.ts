/** KLIC Q-Map (KQ-6) — official KRDS-MCP + only needed extras */

export type PlanId = "free" | "standard" | "premium";
export type UserRole = "user" | "admin";
export type AnalysisStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Public severity (report) */
export type FindingSeverity = "critical" | "serious" | "moderate" | "minor";

/** KLIC priority language */
export type KqPriority = "P0" | "P1" | "P2" | "P3";

/**
 * KLIC RADIUS axes — key letter matches RADIUS
 * kq_r/a/d/i/u/s
 */
export type RuleDomain =
  | "kq_r"
  | "kq_a"
  | "kq_d"
  | "kq_i"
  | "kq_u"
  | "kq_s";

export type RuleResultStatus = "pass" | "fail" | "na" | "skip" | "ex";

/** How a rule/axis was evaluated */
export type EvalMethod = "simulated" | "measured";

/** Public-service scenes (KLIC) */
export type KqScene =
  | "SC-HOME"
  | "SC-FIND"
  | "SC-APPLY"
  | "SC-AUTH"
  | "SC-PAY"
  | "SC-INFO"
  | "SC-OPS"
  | "SC-ALL";

export type RuleSource = "krds-mcp" | "klic-ext";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: PlanId;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface RuleDef {
  id: string;
  domain: RuleDomain;
  /** KQ axis code e.g. KQ-V */
  axisCode: string;
  category: string;
  subcategory: string;
  code: string;
  title: string;
  description: string;
  severityDefault: FindingSeverity;
  priorityDefault: KqPriority;
  tags: string[];
  scenes: KqScene[];
  source: RuleSource;
  sourceRef?: string;
  viewport?: "mobile" | "tablet" | "desktop" | "all";
}

export interface RuleResult {
  ruleId: string;
  code: string;
  domain: RuleDomain;
  category: string;
  subcategory: string;
  title: string;
  status: RuleResultStatus;
  severity: FindingSeverity;
  priority: KqPriority;
  message: string;
  recommendation: string;
  viewport?: string;
  scenes?: KqScene[];
  /** 실측 A축 확장 (axe → KWCAG 매핑 등) */
  kwcag?: {
    code: string;
    title: string;
    level?: "A" | "AA" | "AAA";
    mapped: boolean;
  };
  scenarioTags?: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
  evidenceKind?: "dom" | "axe" | "keyboard" | "geometry" | "heuristic";
  reproducible?: { steps: string[]; selectors?: string[] };
  selector?: string;
  evidence?: string;
}

export interface DomainScore {
  domain: RuleDomain;
  label: string;
  axisCode: string;
  totalRules: number;
  evaluated: number;
  passed: number;
  failed: number;
  skipped: number;
  na: number;
  score: number;
  criticalFails: number;
  seriousFails: number;
  weight: number;
  /** simulated = catalog roll; measured = live probe */
  method: EvalMethod;
}

export interface CategoryBreakdown {
  domain: RuleDomain;
  category: string;
  subcategory: string;
  total: number;
  passed: number;
  failed: number;
  score: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  code: string;
  domain: RuleDomain;
  category: string;
  subcategory: string;
  severity: FindingSeverity;
  priority: KqPriority;
  title: string;
  description: string;
  recommendation: string;
  viewport?: string;
  scenes?: KqScene[];
  method?: EvalMethod;
  /** KWCAG 2.2 매핑 (실측 A축) */
  kwcag?: {
    code: string;
    title: string;
    level?: "A" | "AA" | "AAA";
    mapped: boolean;
  };
  scenarioTags?: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
  evidenceKind?: "dom" | "axe" | "keyboard" | "geometry" | "heuristic";
  reproducible?: { steps: string[]; selectors?: string[] };
  selector?: string;
  evidence?: string;
}

export interface RoadmapScenario {
  id: "min" | "standard" | "max";
  label: string;
  summary: string;
  estimatedWeeks: number;
  estimatedMm: number;
  focus: string[];
  coversFindingIds: string[];
}

export interface ReportSection {
  id: string;
  number: number;
  title: string;
  body: string;
  domain?: RuleDomain | "exec" | "roadmap" | "appendix";
}

export interface AnalysisReport {
  analysisId: string;
  generatedAt: string;
  engine: string;
  overallScore: number;
  grade: string;
  summary: string;
  totalCatalogRules: number;
  evaluatedRuleCount: number;
  passCount: number;
  failCount: number;
  naCount: number;
  domainScores: DomainScore[];
  categoryBreakdown: CategoryBreakdown[];
  findings: Finding[];
  roadmap: RoadmapScenario[];
  sections: ReportSection[];
  taxonomy: "RADIUS";
  /** honesty: default simulated until axes promoted */
  defaultMethod: EvalMethod;
  measuredAxes: RuleDomain[];
  simulatedAxes: RuleDomain[];
  methodNote: string;
  probe?: {
    url: string;
    fetchedAt?: string;
    ok: boolean;
    status?: number;
    error?: string;
    headersSample?: Record<string, string>;
  };
  /** Aditus-style static HTML inspect */
  inspect?: {
    finalUrl: string;
    status: number;
    title: string;
    elapsedMs: number;
    bytes: number;
    error?: string;
    hitCount: number;
    pass: number;
    fail: number;
    na: number;
    mode?: string;
    maxPages?: number;
    rendered?: boolean;
    pagesCrawled?: number;
    axe?: { pages: number; violations: number; passes: number };
    /** A축 실측 패키지 (KWCAG 매핑·키보드·대비·시나리오) */
    a11y?: {
      kwcagMapVersion: string;
      kwcagMapped: number;
      kwcagUnmapped: number;
      contrastFails: number;
      keyboard?: {
        focusable: number;
        tabsSampled: number;
        noVisibleFocus: number;
        trapSuspect: boolean;
      };
      outline?: {
        h1: number;
        headings: number;
        landmarks: string[];
        orderIssues: number;
      };
      targetSize?: {
        smallTargets: number;
        totalClickable: number;
      };
      media?: {
        mediaCount: number;
        missingCaptions: number;
        autoplayUnmuted: number;
      };
      reflow?: {
        zoom: number;
        overflow: boolean;
        ratio: number;
      };
      scenarios: Array<{
        id: string;
        label: string;
        score: number;
        method: "measured" | "heuristic" | "manual_gap";
        blockers: number;
        manualHints: string[];
      }>;
      coverageNote: string;
    };
    crawlErrors?: string[];
    /** 크롤 제한 사유 — 왜 depth가 안 갔는지 */
    crawlNotes?: string[];
    /** 사이트 맵 — 크롤 페이지 계층 */
    sitemap?: {
      nodes: Array<{ url: string; label: string; depth: number; status: number }>;
      edges: Array<{ from: number; to: number }>;
      maxDepth: number;
    };
  };
}

export interface AnalysisOptions {
  includeKrds: boolean;
  includeKwcag: boolean;
  includeSecurity: boolean;
  includeResponsive: boolean;
  /** axis overrides; if set, wins over include* */
  axes?: Partial<Record<RuleDomain, boolean>>;
  maxFindings?: number;
  /** default false: score from live inspect only */
  includeCatalogSim?: boolean;
  /** static | render | render+axe (default render+axe) */
  inspectMode?: "static" | "render" | "render+axe";
  /** same-origin crawl page cap 1..20 (default 3) */
  maxPages?: number;
  /** crawl depth 0..3 (default 2) */
  maxDepth?: number;
  /** A축 실측 프로파일 (KWCAG/키보드/대비/타깃/미디어/reflow) */
  a11yProfile?: {
    enabled?: boolean;
    keyboard?: boolean;
    contrastPanel?: boolean;
    outline?: boolean;
    targetSize?: boolean;
    media?: boolean;
    reflow?: boolean;
    scenarios?: boolean;
    maxTabs?: number;
  };
}

export interface AnalysisJob {
  id: string;
  userId: string;
  targetUrl: string;
  title: string;
  status: AnalysisStatus;
  progress: number;
  options: AnalysisOptions;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  report?: AnalysisReport;
}

export interface ContactLead {
  id: string;
  name: string;
  email: string;
  org?: string;
  message: string;
  createdAt: string;
}

export interface StoreData {
  users: User[];
  sessions: Session[];
  analyses: AnalysisJob[];
  contacts: ContactLead[];
  seededAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _p, ...rest } = user;
  void _p;
  return rest;
}

export type StoreShape = StoreData;
