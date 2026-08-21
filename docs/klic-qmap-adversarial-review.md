# 적대적 검토 — KLIC Q-Map (KQ-6) / krds.klic.co.kr 데모

> 검토일: 2026-08-14  
> 대상: `/Users/mini/src/ai-website-cloner-template` (단일 타깃)  
> 방법: 카탈로그 JSON 실측 · 소스 경로 추적 · 라이브 API 프로브 · 주장↔증거 대조  
> 기준: 구조 통과 ≠ 의미 통과. Happy-path 제외, 재현 가능한 실패만 기록.

---

## 0. 한 줄 판결

| 판정 | 내용 |
|---|---|
| **Beta 불가 (현 상태)** | “진단 제품” 대외 주장 시 |
| **Internal demo 가능** | Q-Map 정보구조·리포트 포맷 시연 한정 |
| **핵심 사유** | 판정이 **URL 무관 난수 시뮬**이고, MCP 토큰 커버리지가 깨져 있으며, “공식 MCP” 서사의 일부 숫자가 허위/왜곡 |

---

## 1. 주장 vs 실측 매트릭스

| # | 제품/문서 주장 | 실측 | 등급 |
|---|---|---|---|
| C1 | KRDS-MCP 공식으로 V/U/F | `source=krds-mcp` 211건, ID/코드 중복 0 | **PASS (구조)** |
| C2 | designTokens 반영 | summary `designTokens: 2`, 실제 규칙 토큰 군 **1개** (`token` 2개) — MCP에 color/layout/motion 등 **별도 토큰 export 존재**하나 미흡수 | **FAIL** |
| C3 | 846 매핑 폐기 | 런타임 도메인 `kq_*`, 카탈로그 846 없음 | **PASS** |
| C4 | 제품 UI에 846/ViewCheck 제거 | `src/` 제품 경로 잔존 약함. **docs/** 에 ViewCheck 홍보·846 문서 다수 잔존 | **PARTIAL** |
| C5 | NA/해당없음 분모 제외 | 타입·점수식에 NA 있으나 `evaluateRule`은 **pass/fail만** 생성 → NA 경로 **죽은 코드** | **FAIL** |
| C6 | EX 예외승인 | 타입에만 존재, 생성·UI·리포트 **미구현** | **FAIL** |
| C7 | 장면(Scene) 기반 특화 | U축 일부 추론, 대부분 `SC-ALL`. 장면 매트릭스 UI/점수 **없음** | **PARTIAL** |
| C8 | 전문 진단 엔진 | `hash(id\|url\|time)` + index 롤 **~20% fail** — 페이지 미수집, 스펙 미비교 | **FAIL (의미)** |
| C9 | 심각도/P0 의미 있음 | `sevFor(i%…)` 인덱스 패턴 — 규칙 내용과 **무관한 기계적 분포** | **FAIL** |
| C10 | 가중 종합점수 | 가중치 코드 존재, 그러나 입력이 시뮬 fail이라 점수 **의사과학** | **FAIL (의미)** |
| C11 | rules 카탈로그 API | `GET /api/v1/rules` **비인증 200** (의도일 수 있으나 내부 경로·mcpPath 노출) | **WARN** |
| C12 | analyses 보호 | 비로그인 GET → **401** | **PASS** |
| C13 | 시드 계정 | `demo@klic.local` / 평문 시드·로그인 UI 노출 | **WARN (데모 한정 OK)** |
| C14 | 쿠키 Secure | `VC_COOKIE_SECURE=1` 일 때만 — LAN HTTP 전제. 이름 레거시 `VC_` | **WARN** |
| C15 | 리포트 HTML/PDF/XLSX | 빌드·포맷 존재 (이전 검증). 내용 품질은 시뮬 이슈에 종속 | **PASS (포맷) / FAIL (근거)** |

---

## 2. P0 — 출시/베타 블로커

### P0-1. 판정 엔진이 진단이 아님 (의미 붕괴)
**재현**
```text
evaluateRule(): roll = (seed[i] + i*13) % 100
finalStatus = roll < 20+(...) ? fail : pass
```
- 대상 HTML/DOM/헤더/스크린샷 **미사용**
- 동일 규칙이 URL만 바꿔도 seed에 URL이 들어가 결과만 흔들림 — **실준수와 무관**

**공격 시나리오**
- 영업: “자동 진단” 데모 → 감리/발주 자리에서 **재현 요청** 시 붕괴
- 경쟁 리뷰: “랜덤 리포트 생성기”로 한 줄 종결

**요구 게이트**
- [ ] 최소 1개 축이라도 **결정론적 실측** (예: HTTP 헤더→KQ-S 일부, HTML 파싱→KQ-A 대체텍스트 존재)
- [ ] 리포트에 `method: simulated | measured` 축별 명시 (시뮬이면 대외 “준수율” 금지)

### P0-2. “MCP 공식 커버리지” 숫자 왜곡
**실측**
- summary `mcpInventory.designTokens: 2`
- KQ-V 토큰 규칙: 1카테고리 (`token` 2개)
- 패키지에 `colorTokens`, `layoutTokens`, `motionTokens`, `borderTokens`, `componentTokens` 등 **미연결 export** 존재

**공격 시나리오**
- “공식 MCP 기준” 주장 중 토큰 350 근처 담론/이전 문서와 충돌 → **데이터 파이프 미검증** 들통

**요구 게이트**
- [ ] MCP export 전수 인벤토리 스크립트 + 카탈로그 흡수율 리포트 (누락=0 목표 또는 명시적 out-of-scope 목록)
- [ ] `designTokens: 2` 상태로 “토큰 정렬 진단” 카피 금지

### P0-3. 심각도·P0/P1이 내용과 무관
**실측**
- 생성기 `sev(i % 19/7/3)` → critical/serious가 **규칙 위험과 무관**
- 로드맵 MM·블로커 언어가 이 가짜 severity에 종속

**요구 게이트**
- [ ] 축별 severity 매핑 표 (예: KQ-S 주입= P0 고정, 토큰 미사용= P2)
- [ ] 인덱스 모듈로 severity 부여하는 코드 경로 제거

---

## 3. P1 — 베타 전 필수

### P1-1. NA/EX 제품 서사 공허
- 점수 분모에서 NA 제외한다고 했으나 **fail/pass만 배출**
- EX(예외승인) 타입만 있고 스토어·UI·감사 로그 없음  
→ “공공 감리 특화” 슬라이드 공격에 취약

### P1-2. 확장 축(A/S/R) 설명 품질
- KQ-A: short desc **134/134**
- KQ-R: short desc **90/90**
- KQ-S: short **70/80**  
→ 카탈로그는 있으나 **검사 가능한 문장 밀도 부족** (템플릿 반복)

### P1-3. docs 이중 현실
- 제품은 KQ-6인데 legacy 홍보 문서가 ViewCheck 846 홍보문 그대로였음 (**삭제됨 2026-08-21**)
- 외부/내부 공유 시 잘못된 원본 브리프 유출 위험

### P1-4. 공개 rules API 정보 누수
- `mcpPath` 로컬 절대경로, 생성 시각, 전체 카탈로그 페이징 가능
- 데모 OK, 인터넷 노출 시 내부 구조 정찰 용이

### P1-5. axes vs legacy flags
- UI는 `axes` 전송, 서버는 legacy `includeKrds` 등으로 V/U/F를 **묶음 토글**
- “KQ-V만 끄기”가 legacy 경로에서 **의도대로 안 될 수 있음** (axes 우선이 코드상 있으면 OK — 통합 테스트 부재)

### P1-6. 코드네임 잔재
- ~~경로 `src/lib/viewcheck`, 컴포넌트 `krds-viewcheck`, env `VC_COOKIE_SECURE`~~ → **해소됨 (2026-08-21)**: `viewcheck` 식별자 전량 `krds`로 rename, legacy 문서 제거
- 클론 냄새 / 감사 시 “리브랜딩 껍데기” 공격면

---

## 4. P2 — 품질·해자

| ID | 이슈 | 메모 |
|---|---|---|
| P2-1 | 장면 매트릭스 미구현 | Scene 태그는 데이터만 |
| P2-2 | 기관유형 가중 프리셋 없음 | 가중치 고정 |
| P2-3 | MCP 컴포넌트 3축 고정 배수 | 구조/상태/a11y 기계 복제 — 엔티티 메타 미반영 |
| P2-4 | 서비스 패턴 장면 매핑 키워드 빈약 | 한글 키 일부만 |
| P2-5 | 리포트 “AI 권고” 섹션 | 생성 문장 ≠ 모델 추론; 표현 과장 위험 |
| P2-6 | 파일 스토어 동시성 | JSON rename 수준 — 다중 워커 취약 |
| P2-7 | rate limit / lockout 없음 | 로그인 브루트 가능 (데모) |
| P2-8 | contact API 인증·캡차 없음 | 스팸 |

---

## 5. 적대 페르소나별 한 방

| 페르소나 | 한 방 질문 | 현재 답변 궁지 |
|---|---|---|
| 감리 | “이 Critical 재현 절차 주세요” | URL 시드 난수라 **재현 절차 없음** |
| 발주처 | “846 대비 뭐가 다르냐” | 구조는 다름. **실측 깊이**는 둘 다 도구 의존 — 우리는 아직 시뮬 |
| MCP 기여자 | “토큰 350 어디 갔나” | **2개로 붕괴** — 파이프 버그 |
| 보안 | “세션 탈취면?” | httpOnly+lax. Secure 기본 off. 파일 세션 저장 |
| 경쟁 | “클론 아니냐” | 카피/브랜드는 KLIC. **엔진 깊이·docs 잔재**가 약한 고리 |

---

## 6. 통과한 것 (정직하게)

1. **KQ-6 정보구조** 자체는 차별화 방향이 맞음 (846 시험지 ≠ MCP 부품).  
2. 카탈로그 **ID/코드 전역 중복 0**.  
3. V/U/F `source: krds-mcp` 라벨 일관.  
4. analyses **401** 보호.  
5. 빌드 타입체크 통과 이력 있음.  
6. 리포트 다중 포맷(HTML/PDF/XLSX) 골격 존재.  
7. Aesthete slop 스캔 0 이력 (UI 껍데기).

→ **껍데기·택소노미는 Beta 후보, 진단 의미는 아님.**

---

## 7. Beta 게이트 (나가기 전 체크리스트)

### Gate A — 정직성
- [ ] 랜딩/리포트에 **「시뮬 판정 / 실측 판정」** 배지
- [ ] docs ViewCheck 홍보 아카이브 폴더 분리 또는 삭제
- [ ] “준수율” 단어는 measured 축에만

### Gate B — MCP 충실
- [ ] design/color/layout/motion/border/component tokens 흡수율 ≥ 합의 임계
- [ ] summary.mcpInventory = live MCP export 일치 CI

### Gate C — 최소 실측 1스팬
- [ ] KQ-S: 응답 헤더 5종 이상 실측
- [ ] KQ-A: 이미지 alt 결측 비율 실측 (단일 URL fetch)
- [ ] 나머지 축은 simulated 명시 가능

### Gate D — 운영 필드
- [ ] NA 생성 조건 (미사용 부품) 최소 룰 10+
- [ ] severity 매핑 표 + 생성기 제거
- [ ] axes 단일 토글 E2E 테스트

### Gate E — 노출
- [ ] rules API auth 또는 공개 필드 최소화 (mcpPath 제거)
- [ ] 데모 비번 문서/UI 토글

**Gate A+B+C 미충족 시 외부 데모 스크립트에서 “진단 결과” 금지. UI/리포트 템플릿 데모만.**

---

## 8. 우선 수정 순서 (공수 감각)

| 순위 | 작업 | 효과 |
|---|---|---|
| 1 | 리포트/API/랜딩에 simulated 고지 | 신뢰 리스크 즉시 차단 |
| 2 | MCP 토큰 파이프 수정 + 인벤토리 CI | C2 P0 해소 |
| 3 | severity 매핑 표 | 로드맵 언어 정당화 |
| 4 | KQ-S 헤더 실측 스파이크 | “ coll 측정” 1개 확보 |
| 5 | docs 아카이브 | 클론/846 잔재 차단 |
| 6 | NA 룰 + axes E2E | 서사-코드 정합 |

---

## 9. 결론

KQ-6 택소노미 선택은 **방향 올바름**.  
지금 코드베이스는 **“KLIC 브랜드의 리포트 프린터 + MCP 라벨이 붙은 규칙 DB”** 에 가깝고,  
**적대적 기준의 진단 엔진이 아님**.

다음 스프린트 목표 문장 제안:
> “시뮬을 숨기지 말고, MCP 토큰을 진짜로 흡수하고, 축 하나만이라도 측정으로 승격한다.”

---

## 10. 증거 스냅샷

```
taxonomy: KQ-6
counts: V52 U138 F21 A134 S80 R90 total515 (mcpOfficial211 / ext304)
designTokens inventory claim: 2 → token rules: 1 group
dup ids/codes: 0
GET /api/v1/rules: 200 public
GET /api/v1/analyses: 401
evaluateRule: pass|fail only (~20% fail roll)
```
