import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const FAQS = [
  {
    q: "어떤 사이트에 쓰나요?",
    a: "중앙·공공·지자체 대민 웹, 신청·조회 서비스, 개편 전후 점검, SI 납품 전 자체 검수.",
  },
  {
    q: "분석은 실시간으로 진행되나요?",
    a: "네. 진단을 시작하면 서버 접속→렌더→axe 위반 검사→규칙 평가→리포트 구성 단계가 진행률(%)과 함께 실시간으로 표시됩니다. 크롤링이 끝난 뒤 결과만 보는 방식이 아니라, 분석이 도는 과정을 그대로 확인할 수 있습니다.",
  },
  {
    q: "여러 사이트를 한 번에 분석할 수 있나요?",
    a: "네. 하네스(자동 검증 파이프라인)에서 여러 도메인을 병렬로 탐색하며, 사이트별 HTTP·렌더 여부·axe 위반 건수를 한눈에 비교할 수 있습니다.",
  },
  {
    q: "리포트 형식은?",
    a: "HTML(인쇄/공유), PDF, Excel 다중 시트, CSV. 위반 항목은 축×심각도 매트릭스와 카테고리 요약으로 구조화해 보여주며, 상세는 대시보드에서 도메인 필터로 볼 수 있습니다.",
  },
  {
    q: "리포트 품질은 어떻게 보장하나요?",
    a: "하네스가 자동으로 리포트 문제를 감지합니다. 엔진 버전·점수 범위·스텁 문구(위반 후보 등)·섹션 길이·PDF 페이지 수·내부 규칙키 노출 여부까지 21개 항목을 검사하고, 이전 실행 대비 점수 추이(회귀)도 추적합니다.",
  },
  {
    q: "규칙 체계는 어떻게 되나요?",
    a: "RADIUS 529규칙 체계를 씁니다. D/I/U는 KRDS-MCP 공식 엔티티로 재생성한 225규칙, A는 KWCAG 접근성 134규칙, S는 HTTP 헤더 실측 80규칙, R은 3-뷰포트 반응형 90규칙으로 구성됩니다. 대상 사이트에 해당 없는 부품은 해당 없음으로 처리합니다.",
  },
  {
    q: "KWCAG 접근성은 어떻게 체크하나요?",
    a: "세 겹으로 검사합니다. ① axe-core 실측(렌더 DOM 위반, WCAG/KWCAG 태그 매핑) ② 정적 구조 체크(html lang·img alt·input label/ARIA) ③ KWCAG 134규칙 카탈로그(시나리오별 상세 평가). 기본 포함이며 비활성화할 수 있습니다.",
  },
  {
    q: "운영 주체는?",
    a: `${BRAND.companyName}(${BRAND.companyUrl}). 제품 도메인 ${BRAND.productUrl.replace("https://", "")}.`,
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-card py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            자주 묻는 질문
          </h2>
        </div>

        <div className="mt-10 divide-y divide-border rounded-lg border border-border bg-background">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-4 open:bg-muted/20">
              <summary className="cursor-pointer list-none py-3.5 text-left text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="link" className="text-primary" render={<Link href="/login" />}>
            로그인 후 진단
          </Button>
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section
      id="start"
      className="scroll-mt-20 border-b border-border bg-foreground py-14 text-background sm:py-16"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          표준 준수, 문서부터 정리
        </h2>
        <p className="mt-3 text-sm text-background/75 sm:text-base">{BRAND.tagline}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-11 min-w-[9rem] items-center justify-center rounded-md bg-background px-5 text-sm font-semibold text-foreground"
          >
            진단 시작
          </Link>
          <Link
            href="/rules"
            className="inline-flex h-11 min-w-[9rem] items-center justify-center rounded-md border border-background/40 px-5 text-sm font-semibold text-background"
          >
            규칙 카탈로그
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background py-10 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold">{BRAND.productName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <a href={BRAND.companyUrl} className="hover:text-foreground hover:underline">
            {BRAND.companyUrl.replace("https://", "")}
          </a>
          <span className="mx-2">·</span>
          <a href={BRAND.productUrl} className="hover:text-foreground hover:underline">
            {BRAND.productUrl.replace("https://", "")}
          </a>
          <p className="mt-1">
            © {year} {BRAND.companyName}
          </p>
        </div>
      </div>
    </footer>
  );
}
