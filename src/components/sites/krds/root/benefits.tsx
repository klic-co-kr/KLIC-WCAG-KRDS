const BENEFITS = [
  {
    title: "결재·감리용 문서",
    description: "점수 표 위에 권고·근거·MM이 들어가 내부 결재 자료로 바로 씁니다.",
  },
  {
    title: "개선 후 재검증",
    description: "수정 반영 뒤 동일 척도로 잔여 Critical/Serious를 다시 봅니다.",
  },
  {
    title: "일정 맞춤",
    description: "오픈 D-day·품질 점검 주기에 맞춰 범위와 시나리오를 줄이거나 늘립니다.",
  },
] as const;

export function Benefits() {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">협업</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            SI·운영·감리가 같은 표를 보게
          </h2>
        </div>

        <ul className="mt-12 grid gap-3 md:grid-cols-3">
          {BENEFITS.map((item, i) => (
            <li key={item.title} className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
