# KRDS-MCP 규칙 카탈로그 검증 리포트

생성: 2026-08-12T23:51:11.728Z  
KRDS-MCP 경로: `/Users/mini/src/krds-mcp`  
재생성 모드: **YES (--regenerate)**

## 1. 설치

| 항목 | 값 |
|---|---|
| 소스 | https://github.com/KRDS-MCP/krds-mcp |
| 로컬 | `/Users/mini/src/krds-mcp` |
| npm install | 완료 (deps in repo) |
| 데이터 로드 | `data/index.js` OK |

## 2. KRDS-MCP 공식 인벤토리 (stats)

| 항목 | 수 |
|---|---:|
| components | 46 |
| globalPatterns | 11 |
| servicePatterns | 5 |
| colors | 24 |
| typography | 20 |
| designTokensTotal | 350 |

meta.coverage: `{"components":"37/37 (100%)","globalPatterns":"11/11 (100%)","servicePatterns":"5/5 (100%)","designTokens":"Complete","accessibility":"WCAG 2.1 AA"}`  
compliance: `KRDS 2024 Complete` · a11y: WCAG 2.1 AA helper

## 3. 우리 카탈로그 수치

| 도메인 | Before | After | 랜딩 광고 |
|---|---:|---:|---|
| KRDS | 846 | 585 | 846 |
| KWCAG | 134 | 134 | 134 |
| Security | 80 | 80 | (명시 수치 없음) |
| Responsive | 90 | 90 | 3-Viewport |

## 4. 커버리지 (MCP 엔티티 이름 ↔ 규칙 텍스트/sourceRef)

### Before (기존 synthetic 846)
- components: 0.0% (0/46)
- colors: 0.0%
- typography: 0.0%
- global patterns: 0.0%
- service patterns: 0.0%

### After (MCP 재생성)
- components: 100.0% (46/46)
- colors: 100.0%
- typography: 100.0%
- global patterns: 100.0%
- service patterns: 100.0%
- rules with source=krds-mcp: 585
- unique sourceRef: 125

Missing components sample: (none)

## 5. Verdicts

| ID | OK | Detail |
|---|---|---|
| MCP_INSTALL | ✅ | KRDS-MCP loaded from /Users/mini/src/krds-mcp (data/index.js) |
| MCP_COMPONENT_COUNT | ✅ | components=46 (meta claims 37/37) |
| CATALOG_KRDS_NONEMPTY | ✅ | krds rules=585 |
| CLAIM_846_VS_REALITY | ❌ | 랜딩 846 ≠ MCP 원자 엔티티 합(컴포넌트 46+색 24+타입 20+패턴 16). 846은 검사 축 확장 마케팅 수치로 취급. |
| COVERAGE_COMPONENTS | ✅ | component name coverage 100.0% (46/46) missing sample:  |
| COVERAGE_COLORS | ✅ | color coverage 100.0% |
| COVERAGE_TYPO | ✅ | typography coverage 100.0% |
| COVERAGE_PATTERNS | ✅ | global 100.0% / service 100.0% |
| KWCAG_PACK_PRESENT | ✅ | kwcag.json=134 (랜딩 134 맞춤, MCP는 WCAG 헬퍼) |
| SECURITY_RWD_PRESENT | ✅ | security=80, responsive=90 |

**요약: PASS 9 / FAIL 1**

## 6. 해석

1. **KRDS-MCP는 "846 검사 규칙 리스트"가 아니라** 디자인 시스템 **엔티티 카탈로그 + 접근성 헬퍼**다.
2. 원본 랜딩의 **846**은 MCP 원자 개수와 1:1이 아니다. 검사 축을 곱한 **마케팅/제품 규칙 수**로 보는 게 맞다.
3. 기존 카탈로그는 카테고리 구조는 맞지만 **실 컴포넌트/패턴 이름 커버리지가 약함**.
4. `--regenerate` 시 MCP 엔티티×검사축으로 KRDS 규칙을 재작성해 **이름 커버리지를 올림**.
5. KWCAG 134 / 보안 / 반응형은 MCP 범위 밖(또는 WCAG 헬퍼 수준) → 별도 도메인 유지가 맞음.

## 7. 다음 액션

- [ ] 분석 엔진이 MCP `AccessibilityValidator` / 토큰 값을 실제 판정에 사용
- [ ] KRDS 규칙 code를 MCP id와 안정 매핑 테이블로 고정
- [ ] 846을 UI에 쓸 경우 "MCP 엔티티 기반 확장 규칙 N개"로 카피 정정

## 8. 재실행

```bash
# 검증만
node scripts/validate-krds-mcp.mjs

# MCP 기반 KRDS 규칙 재생성 + 검증
node scripts/validate-krds-mcp.mjs --regenerate
```
