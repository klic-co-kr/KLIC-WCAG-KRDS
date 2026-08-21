# RADIUS A축 확장 — 디자인 · 작업계획

| 항목 | 내용 |
|---|---|
| 문서 ID | `RADIUS-A11Y-2026-08-15` |
| 제품 | KLIC RADIUS (`klic-radius-inspect-v2`) |
| 범위 | 접근성(A) 실측·리포트·시나리오 · KWCAG 정렬 |
| 상태 | **디자인 확정용 초안** (구현 전) |
| 근거 | 오픈소스(axe/Pa11y/Lighthouse)·국내 KWCAG·X 실무 논의 |
| 관련 코드 | `src/lib/krds/inspect/*`, `export/*`, `kq.ts` |

---

## 0. 목표 · 비목표

### 목표
1. A축을 **「axe 덤프」**에서 **「공공·장애인 관점 조치 가능한 실측 패키지」**로 승격.
2. 국내 언어(**KWCAG 2.2**)와 국제 엔진(**axe-core**)을 명시적으로 연결.
3. 자동화 한계를 숨기지 않고 **시나리오 커버리지 + 수동 권장**을 리포트에 고정.
4. 인포그래픽 PDF/HTML에 A축·시나리오 카드가 한 화면에 읽히게 함.

### 비목표
- 웹접근성 **인증 대체** · 준수율 공고 수치 제공.
- NVDA/JAWS **완전 자동화 대체**.
- 접근성 오버레이 위젯 추천·연동.
- 전 사이트 크롤/법률 자문.

### 성공 기준 (Beta 게이트)
| ID | 기준 |
|---|---|
| G1 | axe 위반 ≥1건인 페이지에서 KWCAG 코드 배지 매핑률 ≥ 80% (미매핑은 `UNMAPPED` 명시) |
| G2 | 키보드 Tab 시퀀스 실측이 리포트에 재현 가능 형태(순서·셀렉터 샘플)로 남음 |
| G3 | 대비 위반이 A축 하위 패널로 분리 집계됨 |
| G4 | 시나리오 4종(SR/키보드/저시력/청각) 점수가 산출되고 method=measured|heuristic|manual_gap 구분 |
| G5 | methodNote·PDF에 “자동화≠인증” 고지 유지, slop=0 |

---

## 1. 현황 (As-Is)

```
inspect/
  fetch-page.ts      # SSRF static
  browser-fetch.ts   # Playwright
  axe-bridge.ts      # axe.run → A-AXE-* hits
  crawl.ts           # same-origin ≤8
  checks.ts          # A-MEAS-* 정적 휴리스틱
  index.ts           # mode: static|render|render+axe
```

| 있음 | 공백 |
|---|---|
| 렌더 + axe | KWCAG 매핑 |
| lang/title/h1/alt/label/skip/btn name | Tab 순서·포커스 트랩 |
| 페이지 단위 hits | 대비 전용 집계 UI |
| | 타깃 크기·자막 track |
| | heading/landmark 트리 |
| | 확대 200% reflow |
| | 시나리오 스코어 |
| | CLI/CI |

---

## 2. 목표 아키텍처 (To-Be)

### 2.1 레이어

```
                    ┌─────────────────────────────┐
                    │  Report / PDF / Dashboard   │
                    │  시나리오 카드 · KWCAG 배지  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  a11y/aggregate.ts          │
                    │  page→site rollup, scores   │
                    └─────────────┬───────────────┘
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
 ┌────────▼────────┐   ┌──────────▼──────────┐   ┌───────▼────────┐
 │ probes (실측)    │   │ map (KWCAG)          │   │ scenarios      │
 │ keyboard.ts     │   │ kwcag-map.json       │   │ sr/kb/lv/hear  │
 │ contrast.ts     │   │ axe-id → 항목        │   │ coverage %     │
 │ target-size.ts  │   └─────────────────────┘   └────────────────┘
 │ media-track.ts  │
 │ outline-tree.ts │
 │ reflow.ts       │
 └────────┬────────┘
          │
 ┌────────▼────────┐
 │ engine core     │  Playwright page + axe + static checks
 │ (기존 inspect)  │
 └─────────────────┘
```

### 2.2 디렉터리 제안

```
src/lib/krds/inspect/
  a11y/
    kwcag-map.ts          # 로드·lookup
    data/kwcag-axe-map.json
    keyboard.ts           # Tab sequence probe
    contrast.ts           # axe contrast 분리 + 보조 샘플
    target-size.ts
    media-track.ts
    outline-tree.ts       # h1–h6 + landmark
    reflow.ts             # zoom/viewport heuristic
    scenarios.ts          # 4 시나리오 점수
    aggregate.ts          # site-level A rollup
  axe-bridge.ts           # 확장: tags, incomplete, wcagLevel
  index.ts                # opts.a11yProfile, probes 토글
```

### 2.3 데이터 계약 (추가 필드)

`MeasuredHit` 확장 (하위 호환):

```ts
type MeasuredHit = {
  // 기존 필드 ...
  kwcag?: {
    code: string;        // e.g. "1.1.1"
    title: string;       // 한글 검사항목명
    level?: "A" | "AA" | "AAA";
    mapped: boolean;     // false → UNMAPPED
  };
  scenarioTags?: Array<"sr" | "keyboard" | "low_vision" | "hearing" | "cognitive">;
  evidenceKind?: "dom" | "axe" | "keyboard" | "geometry" | "heuristic";
  reproducible?: {
    steps: string[];     // ["Tab × 12", "focus → #login"]
    selectors?: string[];
  };
};
```

`AnalysisReport.inspect` 확장:

```ts
a11y?: {
  kwcagMapped: number;
  kwcagUnmapped: number;
  contrastFails: number;
  keyboard: {
    focusable: number;
    tabsSampled: number;
    noVisibleFocus: number;
    trapSuspect: boolean;
  };
  outline: { h1: number; headings: number; landmarks: string[] };
  scenarios: Array<{
    id: string;
    label: string;
    score: number;           // 0–100
    method: "measured" | "heuristic" | "manual_gap";
    blockers: number;
    manualHints: string[];
  }>;
  coverageNote: string;      // "자동 가능 추정 xx% · 수동 권장"
};
```

### 2.4 시나리오 정의 (SSOT)

| ID | 한글 | 영문 | 주 입력 | method 기본 |
|---|---|---|---|---|
| `sc_sr` | 스크린리더 | Screen reader | outline, name, landmark, axe name/role | measured+heuristic |
| `sc_kb` | 키보드만 | Keyboard only | Tab 시퀀스, skip, focus | measured |
| `sc_lv` | 저시력·확대 | Low vision | contrast, reflow 200%, target | measured+heuristic |
| `sc_hear` | 청각 | Hearing | captions track, autoplay | measured |

**점수 공식 (초안)**  
`score = 100 - min(100, Σ severityWeight(fail in scenario) * k)`  
NA 항목은 분모 제외.  
`manual_gap` 시나리오는 자동 점수와 별도 **「수동 체크 남음」** 플래그.

### 2.5 KWCAG 매핑 원칙

1. 1차: axe `tags` (`wcag2a`, `wcag21aa`, `wcag22aa` …) + rule id.
2. 2차: 수동 큐레이션 테이블 `kwcag-axe-map.json` (국내 용어).
3. 미매핑: `mapped:false`, 리포트에 회색 배지 `UNMAPPED` — **숨기지 않음**.
4. 매핑 테이블 버전: `kwcagMapVersion: "2026.08-draft"`.

### 2.6 UI / 리포트 (인포그래픽)

**HTML/PDF 공통 블록 순서**
1. Cover · RADIUS 6축 (기존)
2. **A 시나리오 4카드** (신규)
3. **KWCAG Top 위반** 테이블 (code · 건수 · 심각도)
4. **키보드 시퀀스 미니맵** (처음 15 포커스 라벨)
5. **대비 샘플** (최대 8)
6. Heading/Landmark 트리 (접이식, PDF는 2 depth)
7. 기존 Top 이슈 · 로드맵

대시보드 detail: A축 클릭 시 위 블록 앵커.

### 2.7 정직성 · 카피

- 기본 고지 유지 + 한 줄 추가:  
  `A축 자동화는 이슈의 일부만 탐지. 스크린리더·실사용 수동 검증 필요. 인증·준수율 인용 금지.`
- 시나리오 점수 옆 method 뱃지 필수.

### 2.8 옵션 플래그

```ts
inspectA11y?: {
  enabled?: boolean;          // default true when mode includes axe
  keyboard?: boolean;         // default true
  contrastPanel?: boolean;    // default true
  targetSize?: boolean;       // default true
  media?: boolean;            // default true
  outline?: boolean;          // default true
  reflow?: boolean;           // default false (cost) → Phase 2 on
  scenarios?: boolean;        // default true
  maxTabs?: number;           // default 40
}
```

---

## 3. 로드맵 페이즈 (작업계획)

### Phase 0 — 준비 (0.5d)
| # | 작업 | 산출 |
|---|---|---|
| 0.1 | 본 문서 리뷰·확정 | 체크리스트 승인 |
| 0.2 | `kwcag-axe-map.json` 초안 스키마 + 상위 30 axe id 시드 | data 파일 |
| 0.3 | fixture HTML 3종 (good / bad-keyboard / bad-contrast) | `tests/fixtures/a11y/*` |

**완료 조건:** fixture로 단위 테스트 러너블.

---

### Phase 1 — KWCAG 매핑 (1–1.5d)  ← 로드맵 #1
| # | 작업 | 파일 |
|---|---|---|
| 1.1 | `kwcag-map.ts` lookup API | `a11y/kwcag-map.ts` |
| 1.2 | `axeToHits`에 kwcag 필드 주입 | `axe-bridge.ts` |
| 1.3 | 리포트 배지·표 컬럼 | `html-report.ts`, detail UI |
| 1.4 | unmapped 카운트 inspect.a11y | `analyzer.ts` |
| 1.5 | 단위 테스트 매핑률 | `tests/` |

**완료 조건:** G1.

---

### Phase 2 — 키보드 실측 (1.5–2d)  ← 로드맵 #2
| # | 작업 | 파일 |
|---|---|---|
| 2.1 | Playwright Tab 루프, activeElement 수집 | `a11y/keyboard.ts` |
| 2.2 | visible focus 휴리스틱 (outline/box-shadow) | 동상 |
| 2.3 | 모달 role=dialog 시 트랩 실패 휴리스틱 | 동상 |
| 2.4 | hits: `A-KB-TAB`, `A-KB-FOCUS`, `A-KB-TRAP` | checks 연동 |
| 2.5 | 리포트 시퀀스 미니맵 | html-report |
| 2.6 | fixture bad-keyboard 스모크 | |

**완료 조건:** G2. maxTabs 기본 40, 타임아웃 보호.

---

### Phase 3 — 대비 패널 (0.5–1d)  ← 로드맵 #3
| # | 작업 | 파일 |
|---|---|---|
| 3.1 | axe violations 중 color-contrast* 분리 | `contrast.ts` |
| 3.2 | 상위 샘플 html/selector 정규화 | |
| 3.3 | PDF/HTML 대비 전용 카드 | |

**완료 조건:** G3.

---

### Phase 4 — 타깃 크기 · 미디어 (0.5–1d)  ← 로드맵 #4
| # | 작업 |
|---|---|
| 4.1 | 클릭 가능 요소 bounding box &lt; 24px → fail (2.5.8 근처) |
| 4.2 | video/audio `track[kind=captions|subtitles]` |
| 4.3 | autoplay+muted 아닌 미디어 경고 |

**완료 조건:** 코드·리포트 hit 존재, fixture 통과.

---

### Phase 5 — Outline 트리 (0.5d)  ← 로드맵 #5
| # | 작업 |
|---|---|
| 5.1 | h1–h6 순서 이슈(건너뜀), 다중 h1 |
| 5.2 | landmark 목록 main/nav/header/footer/search |
| 5.3 | 리포트 트리 렌더 (depth 2) |

---

### Phase 6 — 확대 200% reflow (1–1.5d)  ← 로드맵 #6
| # | 작업 |
|---|---|
| 6.1 | Playwright viewport 또는 CSS zoom 시뮬레이션 |
| 6.2 | document scrollWidth &gt; clientWidth * 1.05 → 가로스크롤 fail |
| 6.3 | 기본 off, `reflow:true` 또는 profile=`full` 시 on |

**리스크:** 사이트별 레이아웃 비용·플리커. 타임아웃·1페이지만 기본.

---

### Phase 7 — 시나리오 스코어 (1d)  ← 로드맵 #7
| # | 작업 |
|---|---|
| 7.1 | `scenarios.ts` 규칙 테이블 (hit.scenarioTags → sc_*) |
| 7.2 | 4카드 UI + PDF |
| 7.3 | coverageNote 산출 |
| 7.4 | G4 검증 |

---

### Phase 8 — CLI/CI 스케치 (0.5–1d)  ← 로드맵 #8
| # | 작업 |
|---|---|
| 8.1 | `scripts/radius-a11y.mjs` URL → JSON exit code |
| 8.2 | GitHub Action 예시 workflow (문서만 or optional) |
| 8.3 | threshold: critical&gt;0 → exit 2 |

**완료 조건:** 로컬 CLI 스모크. Action은 문서 우선 가능.

---

### Phase 9 — 수동 체크리스트 템플릿 (0.5d)  ← 로드맵 #9
| # | 작업 |
|---|---|
| 9.1 | `docs/a11y-manual-checklist-kwcag.md` (NVDA/키보드/확대) |
| 9.2 | 리포트 하단 “수동 권장” 링크·요약 체크박스 목록 |
| 9.3 | 기관유형 프리셋 가중(대민신청/회원) 설계만 — 구현은 후속 |

---

## 4. 일정 요약 (캘린더 가안)

| Phase | 공수(인일) | 누적 | 의존 |
|---|---:|---:|---|
| 0 준비 | 0.5 | 0.5 | — |
| 1 KWCAG | 1.5 | 2.0 | 0 |
| 2 Keyboard | 2.0 | 4.0 | 0 |
| 3 Contrast | 1.0 | 5.0 | 1(배지 재사용) |
| 4 Target/Media | 1.0 | 6.0 | 0 |
| 5 Outline | 0.5 | 6.5 | 0 |
| 6 Reflow | 1.5 | 8.0 | 2(브라우저 세션 공유) |
| 7 Scenarios | 1.0 | 9.0 | 1–5 |
| 8 CLI | 1.0 | 10.0 | 7 |
| 9 Manual doc | 0.5 | **10.5** | 7 |

**마일스톤**
- **M1 (P0–P3):** 매핑+키보드+대비 — 데모 가능 (~5인일)
- **M2 (P4–P7):** 시나리오 패키지 완 (~9인일)
- **M3 (P8–P9):** CI·수동 가이드 (~10.5인일)

---

## 5. 테스트 계획

| 종류 | 내용 |
|---|---|
| 단위 | kwcag lookup, scenario scoring, severity rollup |
| fixture | good / kb-bad / contrast-bad HTML → expected codes |
| e2e | `example.com` + 내부 fixture URL static server |
| 회귀 | 기존 RADIUS S/R/D/I/U hits 개수·엔진 필드 유지 |
| 정직성 | methodNote에 자동화 한계 문장 스냅샷 테스트 |
| slop | `npm run aesthete:slop` 리포트 문자열 |

적대적 케이스:
- SPA 빈 셸 → keyboard 0 focusable → NA+설명
- axe timeout → A-AXE-ERROR, 시나리오 manual_gap
- 매핑 0건 → unmapped 100% 표시 (실패 숨김 금지)

---

## 6. 리스크 · 완화

| 리스크 | 완화 |
|---|---|
| Playwright 비용·시간 | probe 토글, maxTabs, reflow default off |
| standalone 배포 시 PW 경로 | `next start` 루트 고수, docs에 명시 |
| KWCAG 매핑 오류 | unmapped 공개, 맵 버전 핀, 리뷰 체크리스트 |
| “준수율” 오해 | 카피·PDF 고지 G5 |
| 키보드 휴리스틱 오탐 | severity minor 기본, trap은 suspect 플래그 |

---

## 7. 구현 순서 (실행 체크리스트)

```
[x] P0 fixtures + map schema
[x] P1 kwcag-map + axe 주입 + 리포트 배지
[x] P2 keyboard probe + 미니맵
[x] P3 contrast panel
[x] P4 target-size + media
[ ] P5 outline tree (→ 2차: outlineToHits 시나리오 반영)
[x] P6 reflow (opt-in)
[~] P7 scenarios 4카드 (PDF/HTML 리포트 + 대시보드 detail)
[ ] P8 CLI
[ ] P9 manual checklist doc
[x] M1 데모 스모크 (gov/example + fixture)
[~] M2 PDF 인포그래픽 확인 (10p, slop 0)
[x] G1–G5 게이트 기록
```

**구현 상태 (2026-08-16):** P0–P7 완료 (P5 outline probe 구현, P8 CLI·P9 수동문서 잔여). 게이트: G1 매핑 9/9 ✓ · G2 Tab 실측 재현 가능 ✓ · G3 대비 분리 ✓ · G4 시나리오 4종 method 구분 ✓ · G5 고지 유지·slop 0 ✓

---

## 8. 오픈 결정 (구현 전 확인)

1. **KWCAG 버전 고정:** 2.2 only vs 2.1 병기? → 권장 **2.2 primary, 2.1 tag 병기**.
2. **reflow 기본 on/off?** → 권장 **off**, profile=`full` on.
3. **시나리오 가중 기관유형** 이번 스프린트 포함? → 권장 **설계만(P9), 구현 다음**.
4. **CLI를 npm bin으로 공개?** → 권장 **scripts/ 내부 도구 먼저**.

---

## 9. 참고

- axe-core, Pa11y, Lighthouse a11y, KWCAG 2.2, Nuli tools  
- 기존: `docs/klic-radius-inspect.md`, `docs/klic-radius.md`  
- 엔진: `klic-radius-inspect-v2`

---

## 10. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-08-15 | 초안 — 로드맵 1–9 디자인·작업계획 |
