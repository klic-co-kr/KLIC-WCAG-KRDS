# Gate 작업 로그 — 적대적 검토 순서 반영

날짜: 2026-08-14  
대상: KLIC Q-Map (`ai-website-cloner-template`)

## 1. simulated | measured 고지
- `AnalysisReport.methodNote`, `measuredAxes`, `simulatedAxes`, `defaultMethod`
- `DomainScore.method`, `Finding.method`
- 리포트 섹션 0 「판정 방식 고지」
- HTML 커버 경고 배너 / PDF methodNote / 대시보드·상세 UI 배지
- 종합 점수 라벨: **참고·시뮬포함**
- brand.honesty

## 2. MCP 토큰 파이프
- `scripts/generate-kq-catalog.mjs` 가 color/layout/motion/border/component 등 export 수집
- **token groups 15 · leaves 637** (이전 groups 1 / leaves 2)
- KQ-V 66 (원칙+색+타이포+토큰군)
- summary.tokenCoverage + mcpInventory
- public rules summary 에서 **mcpPath 제거**

## 3. severity 매핑
- `src/lib/krds/severity-map.ts`
- 생성기 인덱스 `%` 제거 → 내용 매핑
- 엔진 `resolveSeverity` 동일 맵 사용

## 4. KQ-S 헤더 실측
- `src/lib/krds/probe.ts` + 7 checks (CSP/HSTS/XFO/XCTO/RP/PP/HTTPS)
- `evaluateJob` async fetch
- 스모크 `https://www.gov.kr`: probe 200, measured findings 예) CSP/XFO/RP/PP
- KQ-S domain method = **measured** (헤더 실측 + 카탈로그 시뮬 혼합, 축 배지 measured)

## 5. docs 정리
- ~~`docs/archive/viewcheck-legacy/` 로 ViewCheck 홍보·846·공지 raw 이동~~ → **제거됨 (2026-08-21)**, 이제 브랜드 금지 정책(`docs/klic-krds-brand.md`)만 유지
- README: 제품 카피 사용 금지

## 카탈로그 스냅샷
| | n |
|---|---:|
| total | 529 |
| mcpOfficial | 225 |
| klicExt | 304 |
| token leaves | 637 |

## 남은 한계 (정직)
- V/U/F/A/R 및 KQ-S 카탈로그 본문은 여전히 **시뮬**
- NA/EX 미생성
- 준수율 대외 인용은 **실측 이슈만** 허용
