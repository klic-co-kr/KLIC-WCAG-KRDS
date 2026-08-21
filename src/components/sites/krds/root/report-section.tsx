import Link from "next/link";
import { Button } from "@/components/ui/button";

const REPORT_ITEMS = [
  "경영진 요약 · 종합 등급 · 도메인 스냅샷",
  "RADIUS D/I/U (MCP) 상세",
  "A Accessibility 이슈·권고",
  "S Security 실측·권고",
  "3-Viewport 반응형",
  "우선 이슈 · 최소/권장/최대 로드맵 · MM",
] as const;

const DELIVERABLES = [
  "인쇄·공유용 HTML / PDF",
  "Excel 다중 시트 (요약·도메인·이슈·로드맵)",
  "severity 우선순위 표",
  "개선 후 재검증 체크리스트",
] as const;

export function ReportSection() {
  return (
    <section id="report" className="scroll-mt-20 border-b border-border py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-sm font-medium text-primary">리포트</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            임원 보고와 개발 백로그를
            <br />
            같은 문서로
          </h2>
          <p className="mt-3 text-muted-foreground">
            왜 틀렸는지, 어디를 먼저 고칠지, 공수는 얼마나 잡힐지까지 적습니다.
          </p>

          <ul className="mt-6 space-y-2.5">
            {DELIVERABLES.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="outline" size="lg" className="h-10 px-4" render={<Link href="/rules" />}>
              규칙 카탈로그
            </Button>
            <Button size="lg" className="h-10 px-4" render={<Link href="/dashboard" />}>
              리포트 만들기
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 sm:p-7">
          <p className="text-sm font-semibold text-foreground">구성</p>
          <p className="mt-1 text-sm text-muted-foreground">PDF · Excel · HTML · 대시보드</p>
          <ol className="mt-5 space-y-2.5">
            {REPORT_ITEMS.map((item, index) => (
              <li
                key={item}
                className="flex gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm"
              >
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <span className="font-medium text-foreground">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
