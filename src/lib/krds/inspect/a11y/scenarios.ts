/**
 * 시나리오 스코어 — SR / 키보드 / 저시력 / 청각 4종
 *
 * score = 100 - min(100, Σ severityWeight(fail in scenario) × k)
 * method: measured | heuristic | manual_gap
 */
import type { MeasuredHit } from "../checks";

export type ScenarioId = "sc_sr" | "sc_kb" | "sc_lv" | "sc_hear";

export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  en: string;
  input: string;
  defaultMethod: "measured" | "heuristic" | "manual_gap";
  tags: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
}

export const SCENARIOS: ScenarioDef[] = [
  { id: "sc_sr", label: "스크린리더", en: "Screen reader", input: "outline · name · landmark · axe name/role", defaultMethod: "measured", tags: ["sr"] },
  { id: "sc_kb", label: "키보드만", en: "Keyboard only", input: "Tab 시퀀스 · skip · focus", defaultMethod: "measured", tags: ["keyboard"] },
  { id: "sc_lv", label: "저시력·확대", en: "Low vision", input: "contrast · reflow 200% · target", defaultMethod: "heuristic", tags: ["low_vision"] },
  { id: "sc_hear", label: "청각", en: "Hearing", input: "captions track · autoplay", defaultMethod: "measured", tags: ["hearing"] },
];

const SEV_WEIGHT: Record<string, number> = {
  critical: 25,
  serious: 12,
  moderate: 6,
  minor: 2,
};

export interface ScenarioScore {
  id: ScenarioId;
  label: string;
  score: number;         // 0–100
  method: "measured" | "heuristic" | "manual_gap";
  blockers: number;      // critical+serious 수
  manualHints: string[];
}

export function scoreScenarios(hits: MeasuredHit[]): ScenarioScore[] {
  const fails = hits.filter((h) => h.status === "fail");
  return SCENARIOS.map((sc) => {
    const scFails = fails.filter((f) =>
      f.scenarioTags?.some((t) => sc.tags.includes(t as ScenarioDef["tags"][number])),
    );
    const penalty = scFails.reduce((acc, f) => acc + (SEV_WEIGHT[f.severity] ?? 2), 0);
    const score = Math.max(0, 100 - Math.min(100, penalty));
    const blockers = scFails.filter((f) => f.severity === "critical" || f.severity === "serious").length;
    const manualHints: string[] = [];
    if (sc.id === "sc_sr") manualHints.push("NVDA/JAWS로 실제 읽기 순서 확인 필요");
    if (sc.id === "sc_kb") manualHints.push("실제 키보드로 전체 플로우(로그인→신청) 확인 필요");
    if (sc.id === "sc_lv") manualHints.push("200% 확대·색맹 필터로 시각 확인 필요");
    if (sc.id === "sc_hear") manualHints.push("자막·수화 제공 여부 수동 확인 필요");
    return {
      id: sc.id,
      label: sc.label,
      score,
      method: sc.defaultMethod,
      blockers,
      manualHints: scFails.length > 0 ? manualHints : [],
    };
  });
}

/** 커버리지 노트 */
export function coverageNote(hits: MeasuredHit[], unmapped: number): string {
  const total = hits.length || 1;
  const mappedPct = Math.round(((total - unmapped) / total) * 100);
  return `자동 탐지 가능 추정 ${mappedPct}% · 스크린리더·실사용 수동 검증 필요. 인증·준수율 인용 금지.`;
}
