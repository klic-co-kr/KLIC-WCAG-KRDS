/**
 * KWCAG 카탈로그 규칙 ↔ Aditus KWCAG 2.2 인사이트 매핑
 *
 * 출처: klic-eng/KLIC-Aditus `packages/axe-rules/src/kwcag22.json` (33항목)
 * 우리 카탈로그 규칙 코드 `KWCAG-{major}-{seq}` → Aditus 항목 id 연결.
 * subcategory명 → Aditus 항목 정밀 매칭 후, 대분류 코드로 폴백.
 */

export interface AditusKwcag22 {
  id: number;
  category: string;
  title: string;
  isNew: boolean;
  desc: string;
  detailedDesc: string;
  evaluation: string;
  badExample: string;
  goodExample: string;
  codeSnippet?: string;
}

/** 규칙 subcategory → Aditus 항목 id (정밀 매칭 우선) */
export const SUBCAT_TO_ADITUS: Record<string, number[]> = {
  "대체 텍스트": [1],
  "자막 제공": [2],
  "표의 구성": [3],
  "적응 가능": [4],
  "명도 대비": [8],
  "색에 무관한 인식": [6],
  "자동 재생 금지": [7],
  "키보드 접근성": [10],
  "포커스·탐색": [11],
  "조작 가능": [12],
  "문자 단축키": [13],
  "응답시간 조절": [14],
  "중단·일시정지·숨김": [15],
  "깜빡임과 번쩍임": [16],
  "건너뛰기 링크": [17],
  "제목 제공": [18],
  "링크 텍스트": [19],
  "고정된 참조 위치": [20],
  "단일 포인터": [21],
  "포인터 입력 취소": [22],
  "레이블과 네임": [23],
  "동작기반 작동": [24],
  "언어 속성": [25],
  "사용자 요구": [26],
  "예측 가능": [26],
  "도움 정보": [27],
  "오류 정정": [28],
  "폼 라벨": [29],
  "접근 가능한 인증": [30],
  "반복 입력 정보": [31],
  "파싱": [32],
  "ARIA 속성": [33],
  "버튼 접근성": [10, 23],
  "스크린리더 호환": [33],
};

/** 규칙 코드 대분류 → Aditus 항목 id (폴백) */
export const CODE_MAJOR_TO_ADITUS: Record<string, number[]> = {
  "1.1": [1],
  "1.2": [2],
  "1.3": [3, 4],
  "1.4": [6, 8, 9],
  "2.1": [10],
  "2.2": [14, 15],
  "2.3": [16],
  "2.4": [11, 17, 18, 19],
  "2.5": [21, 22, 23],
  "3.1": [25],
  "3.2": [26],
  "3.3": [28, 29],
  "3.4": [30],
  "4.1": [32, 33],
};

/** 규칙 코드에서 대분류 추출 (KWCAG-1.1-001 → 1.1) */
export function majorFromCode(code: string): string | null {
  const m = code.match(/^KWCAG-(\d+\.\d+)-/);
  return m ? m[1] : null;
}

/**
 * 규칙 → Aditus 인사이트 항목들
 * 1) subcategory 정밀 매칭 2) 코드 대분류 폴백
 */
export function aditusIdsFor(
  code: string,
  subcategory: string,
): number[] {
  const bySub = SUBCAT_TO_ADITUS[subcategory];
  if (bySub) return bySub;
  const major = majorFromCode(code);
  if (major && CODE_MAJOR_TO_ADITUS[major]) return CODE_MAJOR_TO_ADITUS[major];
  return [];
}
