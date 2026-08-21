/**
 * 카탈로그 규칙 → 검사 대상 HTML 예시 + 시각적 미리보기
 *
 * 규칙 클릭 시 "이 규칙이 HTML의 어떤 부분을 검사하는지"를
 * 1) 코드로 2) 실제 렌더링된 미리보기(iframe)로 보여준다.
 */

export interface HtmlExample {
  /** 예시 제목 (예: "모바일 뷰포트 meta 태그") */
  label: string;
  /** 어떤 HTML 요소/속성을 검사하는지 설명 */
  target: string;
  /** HTML 코드 예시 (하이라이트 표현용) */
  code: string;
  /** 통과 기준 설명 */
  pass?: string;
  /** 실제 렌더링할 미리보기 HTML (iframe srcDoc) — 인라인 스타일만 */
  preview?: string;
}

/** 미리보기 공통 프레임 스타일 */
const PREVIEW_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Pretendard GOV", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; padding: 16px; background: #f8fafc; color: #1e293b; }
  .cmp { display: flex; gap: 14px; flex-wrap: wrap; }
  .card { border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
  .card-good { border: 1.5px solid #256EF4; background: #fff; }
  .card-bad { border: 1.5px solid #e11d48; background: #fff; }
  .card-head { padding: 8px 12px; font-size: 11px; font-weight: 700; }
  .card-head.good { background: #eef4ff; color: #256EF4; }
  .card-head.bad { background: #fff1f2; color: #e11d48; }
  .card-body { padding: 12px; font-size: 12px; line-height: 1.55; }
  .tag { display: inline-block; border-radius: 5px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
  .tag.good { background: #eef4ff; color: #256EF4; }
  .tag.bad { background: #fff1f2; color: #e11d48; }
  .note { font-size: 10px; margin-top: 6px; }
  .note.good { color: #256EF4; }
  .note.bad { color: #e11d48; }
`;

/** R축: 뷰포트/반응형 */
const R_EXAMPLES: Record<string, HtmlExample> = {
  모바일: {
    label: "모바일 뷰포트 meta 태그",
    target: "<head> 안의 <meta name=\"viewport\"> 요소 — 모바일에서 콘텐츠가 화면 폭에 맞게 렌더링되는지 검사",
    code: `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <!-- ▼ 검사 대상: width=device-width로 모바일 화면 폭에 맞춤 -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div class="card">...</div>
</body>
</html>`,
    pass: "width=device-width + initial-scale=1 필수. viewport 누락 시 모바일에서 데스크톱 축소 렌더링됨.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:180px;">
    <div class="card card-good">
      <div class="card-head good">✅ viewport 있음 — 화면 폭에 맞춤</div>
      <div class="card-body">
        <div style="background:#256EF4; color:#fff; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700;">KLIC 메뉴</div>
        <div style="margin-top:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:12px;">
          콘텐츠가 화면 폭에<br>딱 맞게 표시됩니다.
        </div>
        <div class="note good">width=device-width 적용</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:180px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ viewport 없음 — 데스크톱 축소</div>
      <div class="card-body">
        <div style="background:#e11d48; color:#fff; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700;">KLIC 메뉴</div>
        <div style="margin-top:8px; background:#fff; border:1px solid #fecdd3; border-radius:8px; padding:10px; font-size:8px; line-height:1.8; white-space:nowrap; overflow:hidden; color:#94a3b8;">
          데스크톱 화면이 통째로 줄어들어 글자가 아주 작게 보입니다.
        </div>
        <div class="note bad">모바일에서 확대해야 읽힘</div>
      </div>
    </div>
  </div>
</div>`,
  },
  태블릿: {
    label: "태블릿 breakpoint 미디어쿼리",
    target: "CSS @media 쿼리의 태블릿 구간(768px~1024px) — 태블릿 화면에서 레이아웃이 어긋나는지 검사",
    code: `/* 태블릿 breakpoint (768px ~ 1024px) */
@media (min-width: 768px) and (max-width: 1024px) {
  .gnb {
    flex-wrap: wrap; /* 태블릿에서 메뉴 줄바꿈 */
  }
}`,
    pass: "태블릿 구간에서 콘텐츠 잘림/가로스크롤 없이 레이아웃 유지되는지 확인.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:200px;">
    <div class="card card-good">
      <div class="card-head good">✅ 미디어쿼리 있음 — 메뉴 줄바꿈</div>
      <div class="card-body">
        <p style="font-weight:700; margin-bottom:8px;">메인 메뉴</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <span class="tag good">소개</span><span class="tag good">업무</span><span class="tag good">자료실</span><span class="tag good">공지</span>
        </div>
        <div class="note good">768px~1024px에서 줄바꿈</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:200px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ 미디어쿼리 없음 — 메뉴 잘림</div>
      <div class="card-body" style="overflow:hidden;">
        <p style="font-weight:700; margin-bottom:8px;">메인 메뉴</p>
        <div style="white-space:nowrap; overflow:hidden;">
          <span class="tag bad">소개</span><span class="tag bad">업무</span><span class="tag bad">자료실</span><span class="tag bad">공지</span><span class="tag bad">문의</span><span class="tag bad">오시는 길</span>
        </div>
        <div class="note bad">오른쪽 메뉴가 잘려 보이지 않음</div>
      </div>
    </div>
  </div>
</div>`,
  },
  데스크톱: {
    label: "데스크톱 breakpoint 미디어쿼리",
    target: "CSS @media 쿼리의 데스크톱 구간(1024px 이상) — 넓은 화면에서 콘텐츠가 늘어나는지 검사",
    code: `/* 데스크톱 breakpoint (1024px 이상) */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
}`,
    pass: "데스크톱에서 콘텐츠가 화면 전체로 늘어나지 않고 적정 폭 유지하는지 확인.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:200px;">
    <div class="card card-good">
      <div class="card-head good">✅ max-width 있음 — 중앙 정렬</div>
      <div class="card-body">
        <div style="background:#eef4ff; border-radius:8px; padding:12px; text-align:center; font-weight:600;">콘텐츠 영역</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:10px; color:#64748b;">
          <span>여백</span><span style="background:#c5d8fb; border-radius:4px; padding:2px 16px; color:#256EF4; font-weight:700;">본문</span><span>여백</span>
        </div>
        <div class="note good">max-width: 1200px · 중앙 정렬</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:200px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ max-width 없음 — 화면 끝까지</div>
      <div class="card-body">
        <div style="background:#fff1f2; border-radius:8px; padding:12px; text-align:center; font-weight:600; width:100%;">콘텐츠가 화면 전체로 늘어남</div>
        <div style="display:flex; margin-top:8px; font-size:10px; color:#64748b;">
          <span style="background:#fecdd3; flex:1; text-align:center; border-radius:4px; padding:2px;">화면 끝</span>
          <span style="background:#fecdd3; flex:1; text-align:center; border-radius:4px; padding:2px;">화면 끝</span>
        </div>
        <div class="note bad">넓은 모니터에서 줄이 너무 길어 가독성 저하</div>
      </div>
    </div>
  </div>
</div>`,
  },
  공통: {
    label: "반응형 레이아웃 공통 검사",
    target: "모든 뷰포트에서 가로스크롤/콘텐츠 잘림 발생 여부 — overflow/고정폭 요소 검사",
    code: `body { overflow-x: hidden; }
img, video { max-width: 100%; }
table { overflow-x: auto; }`,
    pass: "뷰포트 폭 320px~1920px에서 가로스크롤이 생기지 않아야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:180px;">
    <div class="card card-good">
      <div class="card-head good">✅ max-width:100% — 유동 크기</div>
      <div class="card-body">
        <div style="background:linear-gradient(135deg,#256EF4,#6ea1ff); border-radius:8px; height:64px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">이미지</div>
        <div class="note good">화면 폭에 맞춰 줄어듦</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:180px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ 고정폭 900px — 가로스크롤</div>
      <div class="card-body" style="overflow:hidden;">
        <div style="background:linear-gradient(135deg,#e11d48,#fb7185); border-radius:8px; height:64px; width:900px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">고정폭 이미지</div>
        <div class="note bad">화면 밖으로 넘쳐 옆으로 잘림</div>
      </div>
    </div>
  </div>
</div>`,
  },
};

/** D축: 디자인 토큰 */
const D_EXAMPLES: Record<string, HtmlExample> = {
  "Government Blue": {
    label: "KRDS Government Blue 토큰",
    target: "CSS 변수(--color-government-blue 등) — 정부 디자인 시스템 브랜드 색상 사용 여부 검사",
    code: `:root {
  --color-government-blue: #256ef4;
}
.primary-btn { background: var(--color-government-blue); }`,
    pass: "브랜드 색상이 #256EF4 등 KRDS 팔레트 값과 일치해야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:180px;">
    <div class="card card-good">
      <div class="card-head good">✅ KRDS 토큰 적용</div>
      <div class="card-body">
        <div style="background:#256EF4; color:#fff; border-radius:8px; padding:10px; text-align:center; font-weight:700;">주요 버튼</div>
        <div class="note good">--color-government-blue: #256EF4</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:180px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ 임의 색상 사용</div>
      <div class="card-body">
        <div style="background:#7b2ff7; color:#fff; border-radius:8px; padding:10px; text-align:center; font-weight:700;">주요 버튼</div>
        <div class="note bad">#7b2ff7 — KRDS 팔레트에 없음</div>
      </div>
    </div>
  </div>
</div>`,
  },
};

/** I축: 컴포넌트별 HTML 예시 */
const I_EXAMPLES: Record<string, HtmlExample> = {
  "헤더 (Header)": {
    label: "헤더(Header) 컴포넌트",
    target: "<header> 요소 — 사이트 상단 공통 영역, 로고·메뉴·검색 배치 검사",
    code: `<header class="header">
  <div class="header-inner">
    <a href="/" class="logo"><img src="/logo.svg" alt="KLIC"></a>
    <nav class="gnb" aria-label="주요 메뉴">
      <ul><li><a href="/intro">소개</a></li></ul>
    </nav>
  </div>
</header>`,
    pass: "header가 최상단에 있고, 로고·메뉴·검색 순서로 구성되어야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="card card-good" style="max-width:520px;">
  <div class="card-head good">✅ &lt;header&gt; — 로고 · 메뉴 · 검색 순서</div>
  <div class="card-body" style="padding:0;">
    <div style="background:#256EF4; color:#fff; padding:12px 16px; display:flex; align-items:center; gap:18px; font-size:13px;">
      <span style="font-weight:800; font-size:15px;">KLIC</span>
      <span style="opacity:.92;">소개</span>
      <span style="opacity:.92;">업무</span>
      <span style="opacity:.92;">자료실</span>
      <span style="margin-left:auto; background:rgba(255,255,255,.18); border-radius:14px; padding:3px 14px; font-size:11px;">검색</span>
    </div>
  </div>
</div>`,
  },
  "푸터 (Footer)": {
    label: "푸터(Footer) 컴포넌트",
    target: "<footer> 요소 — 저작권·기관 정보·관련 사이트 링크 영역 검사",
    code: `<footer class="footer">
  <p class="copyright">© 2026 KLIC. All rights reserved.</p>
  <ul><li><a href="/privacy">개인정보처리방침</a></li></ul>
</footer>`,
    pass: "모든 페이지에 footer가 있고, 필수 정책 링크가 포함되어야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="card card-good" style="max-width:520px;">
  <div class="card-head good">✅ &lt;footer&gt; — 정책 링크 · 저작권</div>
  <div class="card-body" style="padding:0;">
    <div style="padding:12px 16px; font-size:11px; color:#475569;">본문 콘텐츠 영역</div>
    <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:12px 16px; font-size:11px; color:#475569;">
      <div style="display:flex; gap:14px; margin-bottom:6px;">
        <span style="color:#256EF4; font-weight:600;">개인정보처리방침</span>
        <span style="color:#256EF4; font-weight:600;">이용약관</span>
        <span style="color:#256EF4; font-weight:600;">저작권 안내</span>
      </div>
      <p style="color:#94a3b8; font-size:10px;">© 2026 KLIC. All rights reserved.</p>
    </div>
  </div>
</div>`,
  },
  "버튼 (Button)": {
    label: "버튼(Button) 컴포넌트",
    target: "<button> 요소 — type 속성·disabled·aria 속성 검사",
    code: `<!-- 올바른 버튼 -->
<button type="button" class="btn-primary">저장</button>
<!-- 잘못된 버튼: div 클릭 -->
<div class="btn" onclick="submit()">저장</div>`,
    pass: "버튼은 <button> 또는 role=\"button\" 사용, type 명시, 키보드 접근 가능해야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div>
    <div class="card card-good" style="width:190px;">
      <div class="card-head good">✅ &lt;button&gt; 요소</div>
      <div class="card-body">
        <div style="background:#256EF4; color:#fff; border-radius:8px; padding:9px 0; text-align:center; font-weight:700;">저장</div>
        <div class="note good">Tab 이동 · Enter 클릭 가능</div>
      </div>
    </div>
  </div>
  <div>
    <div class="card card-bad" style="width:190px;">
      <div class="card-head bad">❌ &lt;div&gt; 클릭 처리</div>
      <div class="card-body">
        <div style="background:#e2e8f0; color:#64748b; border-radius:8px; padding:9px 0; text-align:center; font-weight:700; cursor:pointer;">저장</div>
        <div class="note bad">키보드 접근 불가 · 스크린리더 무시</div>
      </div>
    </div>
  </div>
</div>`,
  },
};

/** U축: 서비스 패턴 */
const U_EXAMPLES: Record<string, HtmlExample> = {
  "로그인 (Login)": {
    label: "로그인 폼 패턴",
    target: "<form> + 아이디/비밀번호 입력 — 로그인 플로우의 접근성·보안 검사",
    code: `<form action="/api/login" method="post">
  <label for="userid">아이디</label>
  <input id="userid" name="userid" type="text" autocomplete="username" required>
  <label for="password">비밀번호</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">로그인</button>
</form>`,
    pass: "label-연결, autocomplete, 오류 메시지 안내가 필요함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:200px;">
    <div class="card card-good">
      <div class="card-head good">✅ label 연결 · autocomplete</div>
      <div class="card-body">
        <div style="font-size:12px;">
          <div style="font-weight:600; margin-bottom:4px;">아이디</div>
          <div style="border:1px solid #bfdbfe; background:#f8fafc; border-radius:6px; padding:7px 10px; margin-bottom:10px; color:#475569;">user123</div>
          <div style="font-weight:600; margin-bottom:4px;">비밀번호</div>
          <div style="border:1px solid #bfdbfe; background:#f8fafc; border-radius:6px; padding:7px 10px; margin-bottom:12px; color:#475569;">••••••</div>
          <div style="background:#256EF4; color:#fff; border-radius:6px; padding:8px; text-align:center; font-weight:700;">로그인</div>
        </div>
        <div class="note good">입력값 유지 · 브라우저 자동완성</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:200px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ placeholder만 사용</div>
      <div class="card-body">
        <div style="font-size:12px;">
          <div style="border:1px solid #fecdd3; background:#fff; border-radius:6px; padding:7px 10px; margin-bottom:10px; color:#cbd5e1;">아이디를 입력하세요</div>
          <div style="border:1px solid #fecdd3; background:#fff; border-radius:6px; padding:7px 10px; margin-bottom:12px; color:#cbd5e1;">비밀번호</div>
          <div style="background:#e2e8f0; color:#64748b; border-radius:6px; padding:8px; text-align:center; font-weight:700;">로그인</div>
        </div>
        <div class="note bad">입력 후 라벨 사라짐 → 뭐가 뭔지 모름</div>
      </div>
    </div>
  </div>
</div>`,
  },
};

/** S축: 보안 헤더 */
const S_EXAMPLES: Record<string, HtmlExample> = {
  "보안 헤더": {
    label: "HTTP 응답 보안 헤더",
    target: "HTTP 응답 헤더 — CSP/HSTS/X-Frame-Options 등 서버 설정 검사",
    code: `HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
X-Frame-Options: DENY`,
    pass: "CSP·HSTS·XFO·XCTO·RP 헤더가 모두 설정되어야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:220px;">
    <div class="card card-good">
      <div class="card-head good">✅ 보안 헤더 설정됨</div>
      <div class="card-body" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; line-height:1.8; background:#f8fafc;">
        <div>HTTP/1.1 200 OK</div>
        <div style="color:#256EF4;">Content-Security-Policy: default-src 'self'</div>
        <div style="color:#256EF4;">Strict-Transport-Security: max-age=31536000</div>
        <div style="color:#256EF4;">X-Frame-Options: DENY</div>
        <div style="color:#256EF4;">X-Content-Type-Options: nosniff</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:220px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ 헤더 미설정 — 취약</div>
      <div class="card-body" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; line-height:1.8; background:#fff;">
        <div>HTTP/1.1 200 OK</div>
        <div style="color:#94a3b8;">Content-Type: text/html</div>
        <div style="color:#e11d48; font-weight:700;">CSP 없음 → XSS 노출</div>
        <div style="color:#e11d48; font-weight:700;">HSTS 없음 → HTTPS 강제 안 됨</div>
      </div>
    </div>
  </div>
</div>`,
  },
  "전송 보안": {
    label: "HTTPS/TLS 전송 보안",
    target: "URL 스킴(https) + TLS 설정 — 평문 전송 여부 검사",
    code: `<!-- 올바름 -->
<a href="https://klic.co.kr/login">로그인</a>
<!-- 위험: 평문 http -->
<a href="http://klic.co.kr/login">로그인</a>`,
    pass: "모든 폼 전송·링크가 https여야 함.",
    preview: `<style>${PREVIEW_STYLE}</style>
<div class="cmp">
  <div style="flex:1; min-width:190px;">
    <div class="card card-good">
      <div class="card-head good">✅ https — 암호화 전송</div>
      <div class="card-body">
        <div style="background:#eef4ff; border-radius:8px; padding:10px; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:#256EF4;">https://klic.co.kr/login</div>
        <div class="note good">🔒 중간 탈취 불가</div>
      </div>
    </div>
  </div>
  <div style="flex:1; min-width:190px;">
    <div class="card card-bad">
      <div class="card-head bad">❌ http — 평문 전송</div>
      <div class="card-body">
        <div style="background:#fff1f2; border-radius:8px; padding:10px; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:#e11d48;">http://klic.co.kr/login</div>
        <div class="note bad">⚠ 비밀번호가 그대로 노출</div>
      </div>
    </div>
  </div>
</div>`,
  },
};

/** 도메인+subcategory → HTML 예시 (부분 매칭 포함) */
export function htmlExampleFor(domain: string, subcategory: string): HtmlExample | null {
  const pools: Record<string, Record<string, HtmlExample>> = {
    kq_r: R_EXAMPLES,
    kq_d: D_EXAMPLES,
    kq_i: I_EXAMPLES,
    kq_u: U_EXAMPLES,
    kq_s: S_EXAMPLES,
  };
  const pool = pools[domain];
  if (!pool) return null;
  if (pool[subcategory]) return pool[subcategory];
  for (const [key, ex] of Object.entries(pool)) {
    const keyHead = key.split(" ")[0];
    const subHead = subcategory.split(" ")[0];
    if (subcategory.includes(keyHead) || key.includes(subHead)) return ex;
  }
  return null;
}
