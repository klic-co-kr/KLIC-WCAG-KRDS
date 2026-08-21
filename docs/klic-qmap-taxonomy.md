# KLIC Q-Map (KQ-6) 분류 체계

날짜: 2026-08-14  
제품: KLIC KRDS · https://krds.klic.co.kr  
원칙: **846 매핑 폐기** · **KRDS-MCP 공식만 V/U/F** · **필요 시만 A/S/R 확장**

## 한 줄
> 공식 디자인시스템 엔티티(KRDS-MCP) + 공공 운영에 필요한 확장만.

## KQ-6

| 코드 | 축 | 소스 | 가중치 | 규칙 수(생성 시점) |
|---|---|---|---:|---:|
| KQ-V | 비주얼 토큰 | **krds-mcp** | 0.15 | 52 |
| KQ-U | UI 부품 | **krds-mcp** | 0.15 | 138 |
| KQ-F | 서비스 플로우 | **krds-mcp** | 0.20 | 21 |
| KQ-A | 접근 보장 | klic-ext (KWCAG) | 0.25 | 134 |
| KQ-S | 신뢰·보안 표면 | klic-ext | 0.15 | 80 |
| KQ-R | 다기기 안정 | klic-ext | 0.10 | 90 |
| | | | | **합 515** |
| | MCP 공식 소계 | | | **211** |
| | KLIC 확장 소계 | | | **304** |

## MCP 공식 매핑
- principles → KQ-V
- colors / typography / design token 군 → KQ-V
- components × (구조·상태·접근성) → KQ-U
- globalPatterns → KQ-F
- servicePatterns × (흐름·오류) → KQ-F

## 버린 것
- ViewCheck 846 / DS120·CP446·BP108·SP172 광고 수치
- 합성 846 규칙 카탈로그
- 도메인 키 `krds|kwcag|security|responsive` (→ `kq_*`)

## 장면(Scene) 태그
`SC-HOME|FIND|APPLY|AUTH|PAY|INFO|OPS|ALL` — 규칙에 부착, 리포트 확장용.

## 명령
```bash
npm run rules:generate-kq   # KRDS-MCP + 확장 재생성
```

## 엔진
`klic-qmap-v1` · 종합점수 = 축 가중 평균 (NA 분모 제외)
