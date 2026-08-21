# KLIC-Aesthete AI-slop 제거 기록

날짜: 2026-08-13  
대상: `ai-website-cloner-template` (KLIC KRDS · krds.klic.co.kr)  
엔진: [KLIC-Aesthete](https://github.com/klic-co-kr/KLIC-Aesthete) `lib/slop.mjs`  
로컬: `/Users/mini/src/KLIC-Aesthete` (origin/main 최신 pull, `bun install`, test **717 pass**)

## 설치
```bash
git clone https://github.com/klic-co-kr/KLIC-Aesthete.git ~/src/KLIC-Aesthete
cd ~/src/KLIC-Aesthete && bun install && bun run test
```

## 스캔 명령
```bash
# 앱 기동 후
cd ~/src/ai-website-cloner-template
npm run aesthete:slop
# 또는
bun ~/src/KLIC-Aesthete/lib/slop.mjs /tmp/page.html /tmp/page.slop.json --type marketing
```

## Before → After (랜딩 HTML)

| 시점 | slopCount | 주요 findings |
|---|---:|---|
| Before | 1 (live) / 2 (source dump) | `icon-saturation` 23 · `glass` backdrop · `side-tab-border` |
| **After** | **0** on `/` `/login` `/dashboard` `/rules` · source dump **0** | — |

## 제거한 AI-tell

| 시그니처 | 조치 |
|---|---|
| icon-saturation | 랜딩 Lucide 아이콘 과다 제거 → 번호·텍스트 카드 |
| glass / backdrop-filter | 헤더 blur 제거, 리포트 `.glass` 삭제 |
| multi-stop cover gradient | 리포트 표지 solid navy |
| gradient card / colored shadow glow | benefits·CTA 그라데이션·primary shadow 제거 |
| thick top accent bars | roadmap `border-top:4px` 컬러 바 제거 |
| radial hero glow | hero 배경 효과 삭제 |
| 카피 군더더기 | “핵심입니다/설계했습니다/한 번에 제공” 류 단문 재작성 |

## 검증 결과 (재스캔)
```
/          0 slop
/login     0
/dashboard 0
/rules     0
source TSX dump 0
landing svg tags: 1 (로고만)
```

## 제품 스크립트
`npm run aesthete:slop` → `scripts/aesthete-slop-scan.sh`

## 참고
- Aesthete slop v1 = **HTML literal-presence** (advisory, uncalibrated)
- `slop.copy.generic` LLM judge는 v2 stub → unmeasured
- 레이아웃 기하 측정(`measure`/`fix`)은 이번 범위 아님 — **axis-2 slop only**
