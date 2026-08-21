# RADIUS 서버 실측 v2 (확장)

엔진: `klic-radius-inspect-v2`  
참고: [KLIC-Aditus](https://github.com/klic-eng/KLIC-Aditus)

## 모드
| mode | 내용 |
|---|---|
| `static` | HTTP fetch + 구조 체크 (빠름) |
| `render` | Playwright Chromium 렌더 DOM + 구조 체크 |
| `render+axe` | **기본** · 렌더 + axe-core 위반 |

## 크롤
- 동일 origin 링크 BFS
- `maxPages` 1–8 (분석 기본 **3**)
- 페이지마다 RADIUS 구조 체크, axe는 각 페이지 재방문

## 모듈
```
inspect/
  fetch-page.ts      # SSRF-safe static
  browser-fetch.ts   # Playwright
  axe-bridge.ts      # axe-core inject/run
  crawl.ts           # shallow same-origin
  checks.ts          # RADIUS 구조 실측
  index.ts           # inspectUrl()
```

## API
```http
POST /api/v1/inspect
{ "url": "https://example.go.kr", "mode": "render+axe", "maxPages": 3 }
```

```http
POST /api/v1/analyses
{ "targetUrl": "...", "inspectMode": "render+axe", "maxPages": 3 }
```

## 의존
- `playwright` + Chromium
- `axe-core`
- `cheerio`

## 한계
- 로그인 벽·캡차·강한 봇 차단 사이트는 빈 HTML 가능
- 스크린샷·다중 뷰포트 axe·대기열 미포함
- standalone 배포 시 Playwright 브라우저 경로 별도 필요
