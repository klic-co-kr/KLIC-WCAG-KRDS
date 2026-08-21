const FEATURES = [
  {
    n: "01",
    title: "RADIUS D/I/U (MCP)",
    description:
      "Design·Interface·User flow를 KRDS-MCP 엔티티 기준으로 나눕니다. 사이트에 없는 부품은 해당 없음으로 뺍니다.",
  },
  {
    n: "02",
    title: "KWCAG 접근성",
    description:
      "대체 텍스트, 대비, 키보드·포커스, 폼 라벨, ARIA처럼 실사용 장애가 나는 지점을 먼저 적습니다.",
  },
  {
    n: "03",
    title: "보안 표면",
    description:
      "보안 헤더, TLS, 세션, 주입·권한 등 공개 웹에서 바로 보이는 구멍을 severity와 함께 표시합니다.",
  },
  {
    n: "04",
    title: "3-Viewport 반응형",
    description:
      "모바일·태블릿·데스크톱에서 가로 스크롤, 터치 영역, 그리드 붕괴를 같은 기준으로 봅니다.",
  },
  {
    n: "05",
    title: "수정 순서 · MM",
    description:
      "Critical/Serious를 앞에 두고 최소·권장·최대 시나리오 주수와 MM을 적습니다.",
  },
  {
    n: "06",
    title: "PDF · Excel · HTML",
    description:
      "임원 요약, 도메인 점수, 이슈 목록, 로드맵이 들어간 산출물을 내보냅니다.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border bg-card py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">진단 범위</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            무엇을 보는지
          </h2>
          <p className="mt-3 text-muted-foreground">
            감으로 “괜찮겠지”를 줄이고, 백로그를 숫자와 문장으로 만듭니다.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.n}
              className="rounded-lg border border-border bg-background p-5"
            >
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                {feature.n}
              </p>
              <h3 className="mt-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
