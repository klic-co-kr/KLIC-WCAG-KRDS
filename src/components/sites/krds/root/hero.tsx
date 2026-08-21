import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const STATS = [
  { label: "R", value: "Responsive" },
  { label: "A", value: "Accessibility" },
  { label: "D", value: "Design" },
  { label: "I", value: "Interface" },
  { label: "U", value: "User flow" },
  { label: "S", value: "Security" },
] as const;

export function Hero() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {BRAND.companyName} · {BRAND.frameworkName} ·{" "}
            {BRAND.productUrl.replace("https://", "")}
          </p>

          <p className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-[1.25]">
            공공 웹 품질,
            <br />
            <span className="text-primary">{BRAND.frameworkName}</span> 6축으로
            정렬합니다
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              RADIUS 529규칙
            </span>
            <span className="text-xs text-muted-foreground">
              R 90 · A 134 · D/I/U 225 · S 80
            </span>
          </div>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            {BRAND.radiusExpand}. Design·Interface·User flow는 KRDS-MCP 공식,
            Responsive·Accessibility·Security는 필요 확장. S 헤더는 실측, 나머지는
            시뮬(준수율 대외 인용 금지).
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 min-w-[9.5rem] px-5"
              render={<Link href="/dashboard" />}
            >
              진단 시작
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 min-w-[9.5rem] px-5"
              render={<Link href="/rules" />}
            >
              RADIUS 카탈로그
            </Button>
          </div>
        </div>

        <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-6">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card px-2 py-3 text-center"
            >
              <dt className="text-lg font-bold tracking-tight text-primary">
                {s.label}
              </dt>
              <dd className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-xs">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
