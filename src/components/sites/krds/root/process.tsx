const STEPS = [
  {
    step: "1",
    title: "대상·범위",
    description: "대민 URL, 핵심 플로우, 기관 유형을 정합니다.",
  },
  {
    step: "2",
    title: "진단",
    description: "RADIUS 6축을 돌리고 해당 규칙만 남깁니다.",
  },
  {
    step: "3",
    title: "리포트",
    description: "PDF/Excel/HTML과 시나리오 MM을 일정에 맞춰 넘깁니다.",
  },
  {
    step: "4",
    title: "재검증",
    description: "수정 반영 뒤 잔여 Critical/Serious를 같은 척도로 확인합니다.",
  },
] as const;

export function Process() {
  return (
    <section id="process" className="scroll-mt-20 border-b border-border bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">절차</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            개편·오픈 일정에 붙는 순서
          </h2>
          <p className="mt-3 text-muted-foreground">
            진단 → 배분 → 수정 → 재검증. 문서만 쌓이지 않게.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li key={item.step} className="rounded-lg border border-border bg-card p-5">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {item.step}
              </span>
              <h3 className="mt-2 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
