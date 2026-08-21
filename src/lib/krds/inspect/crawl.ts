/** Same-origin multi-page crawl (shallow) — Aditus spider lite */

import * as cheerio from "cheerio";
import type { FetchedPage } from "./fetch-page";
import { fetchPage } from "./fetch-page";
import { fetchPageRendered } from "./browser-fetch";

export type CrawlOptions = {
  maxPages?: number;
  maxDepth?: number;
  sameOriginOnly?: boolean;
  useRender?: boolean;
  timeoutMs?: number;
  /** 등록 도메인(eTLD+1) 기준 크롤 — 서브도메인 분산 사이트(네이버 등) 대응. 기본 true */
  eTLDPlus1?: boolean;
  /** 페이지별 완료 콜백 — 진행률 표시용 */
  onPage?: (p: { done: number; total: number; url: string }) => void;
};

export type CrawledPage = FetchedPage & {
  rendered?: boolean;
  depth: number;
  from?: string;
};

export type CrawlResult = {
  pages: CrawledPage[];
  errors: string[];
  /** 크롤 제한/사유 — 왜 depth가 안 갔는지 (리포트 명시용) */
  notes: string[];
};

function originOf(u: string): string | null {
  try {
    const x = new URL(u);
    return x.origin;
  } catch {
    return null;
  }
}

/** eTLD+1 (등록 도메인) 추출 — www.naver.com → naver.com, sub.example.co.kr → example.co.kr */
function registrableDomain(host: string): string | null {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return host;
  const two = parts.slice(-2).join(".");
  // 2자리 국가 코드 (.co.kr, .or.jp 등) — 뒤 3개가 등록 도메인
  if (parts.length >= 3 && /^(co|or|go|ne|ac|re|pe|je|kr|jp|uk|au|br|cn|de|fr|in|it|mx|nl|ru|sg|tw|za)$/i.test(parts[parts.length - 1]) && parts.length >= 4) {
    // com.co.kr → parts[-4] 까지
    if (/^(com|org|net|gov|edu|ac|co|go|or|ne|pe|re|je|mil|biz|info)$/i.test(parts[parts.length - 2])) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-3).join(".");
  }
  return two;
}

function normalizeLink(href: string, base: string): string | null {
  try {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      return null;
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // strip tracking noise lightly
    return u.toString();
  } catch {
    return null;
  }
}

function extractLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html || "");
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const n = normalizeLink($(el).attr("href") || "", base);
    if (n) out.push(n);
  });
  return out;
}

export async function crawlSite(
  startUrl: string,
  opts: CrawlOptions = {},
): Promise<CrawlResult> {
  const maxPages = Math.min(Math.max(opts.maxPages ?? 8, 1), 20);
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 3, 0), 3);
  const sameOrigin = opts.sameOriginOnly !== false;
  const useRender = opts.useRender === true;
  const useEtd = opts.eTLDPlus1 !== false;
  const rootOrigin = originOf(startUrl);
  const rootHost = rootOrigin ? new URL(rootOrigin).hostname : null;
  const rootEtd = rootHost ? registrableDomain(rootHost) : null;
  const queue: { url: string; depth: number; from?: string }[] = [
    { url: startUrl, depth: 0 },
  ];
  const seen = new Set<string>();      // 크롤 완료 URL
  const enqueued = new Set<string>();  // 큐잉된 URL (중복 큐잉 방지)
  const pages: CrawledPage[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  // depth별 페이지 상한 (균형 크롤 — DFS 과도 깊이 방지)
  const depthCap = new Map<number, number>();
  const capFor = (d: number) => {
    const base = Math.max(2, Math.ceil(maxPages / 4));
    return base + d * 1; // D0: 2, D1: 3, D2: 4, D3: 5 … (maxPages 15 → 5)
  };
  let skippedSubdomain = 0;
  let skippedHash = 0;
  let skippedSeen = 0;
  let skippedPathCap = 0;

  while (queue.length && pages.length < maxPages) {
    const item = queue.shift()!;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    if ((depthCap.get(item.depth) || 0) >= capFor(item.depth)) continue; // depth별 상한

    if (sameOrigin && rootOrigin && originOf(item.url) !== rootOrigin) {
      // eTLD+1 모드면 서브도메인 허용 (www.naver.com → m.naver.com 등)
      if (!useEtd || !rootEtd) continue;
      const itemHost = originOf(item.url) ? new URL(item.url).hostname : null;
      const itemEtd = itemHost ? registrableDomain(itemHost) : null;
      if (!itemEtd || itemEtd !== rootEtd) {
        skippedSubdomain += 1;
        continue;
      }
    }

    try {
      const page = useRender
        ? await fetchPageRendered(item.url, { timeoutMs: opts.timeoutMs })
        : await fetchPage(item.url);

      pages.push({
        ...page,
        rendered: "rendered" in page ? Boolean((page as { rendered?: boolean }).rendered) : false,
        depth: item.depth,
        from: item.from,
      });
      opts.onPage?.({ done: pages.length, total: maxPages, url: item.url });
      depthCap.set(item.depth, (depthCap.get(item.depth) || 0) + 1);

      if (item.depth >= maxDepth) continue; // depth 제한
      if (!page.html) continue;

      // 렌더된 DOM 링크 우선 (JS 메뉴 포함), 없으면 정적 HTML 파싱
      let linkCandidates: string[] = [];
      if (page.domLinks?.length) {
        linkCandidates = page.domLinks;
      } else {
        linkCandidates = extractLinks(page.html, page.finalUrl || item.url);
      }
      const sameOriginCands = linkCandidates.filter((l) => {
        if (sameOrigin && rootOrigin) {
          if (originOf(l) === rootOrigin) return true;
          if (useEtd && rootEtd) {
            const lHost = originOf(l) ? new URL(l).hostname : null;
            const lEtd = lHost ? registrableDomain(lHost) : null;
            return lEtd === rootEtd;
          }
          return false;
        }
        return true;
      });
      // 경로 다양성 샘플링 — 같은 디렉토리 링크는 최대 2개만 큐에 (글로벌 메뉴 중복 방지)
      const pathCount = new Map<string, number>();
      const MAX_PER_PATH = 2;
      let queued = 0;
      for (const link of sameOriginCands) {
        if (enqueued.has(link) || seen.has(link)) {
          skippedSeen += 1;
          continue;
        }
        if (sameOrigin && rootOrigin && originOf(link) !== rootOrigin) {
          if (!useEtd || !rootEtd) continue;
          const lHost = originOf(link) ? new URL(link).hostname : null;
          const lEtd = lHost ? registrableDomain(lHost) : null;
          if (!lEtd || lEtd !== rootEtd) {
            skippedSubdomain += 1;
            continue;
          }
        }
        // prefer same path depth html-ish
        if (/\\.(pdf|zip|png|jpe?g|gif|svg|css|js|woff2?)($|\\?)/i.test(link)) continue;
        // 해시 앵커 (같은 페이지 내 이동) — 크롤 대상 아님
        try {
          const lu = new URL(link);
          if (lu.hash && lu.pathname === new URL(item.url).pathname && lu.search === new URL(item.url).search) {
            skippedHash += 1;
            continue;
          }
        } catch {}
        // 경로 prefix (마지막 세그먼트 2개) 기반 중복 제한
        // 주의: 전자정부/Java 프레임워크 사이트는 같은 경로(main.do, sub/info.do) +
        // 쿼리 파라미터(page=0101&m=0101)로 페이지를 구분 → pathKey에 파라미터 포함
        let pathKey = "/";
        try {
          const u = new URL(link);
          const segs = u.pathname.split("/").filter(Boolean);
          const pageParam = u.searchParams.get("page") || u.searchParams.get("m") || u.searchParams.get("num") || "";
          pathKey = (segs.slice(0, 2).join("/") || "/") + (pageParam ? `?${pageParam}` : "");
        } catch {
          pathKey = "/";
        }
        const cnt = pathCount.get(pathKey) || 0;
        if (cnt >= MAX_PER_PATH) {
          skippedPathCap += 1;
          continue;
        }
        pathCount.set(pathKey, cnt + 1);
        enqueued.add(link); // 큐잉 즉시 enqueued 처리 (중복 큐잉 방지)
        queue.push({ url: link, depth: item.depth + 1, from: item.url });
        queued += 1;
        // 깊이 우선 탐색 (DFS) — depth 큰 URL 먼저 처리 → 3depth 연계도 확보
        queue.sort((a, b) => b.depth - a.depth);
        if (enqueued.size > maxPages * 8) break;
      }
      if (queued === 0 && sameOriginCands.length > 0) {
        // 전부 seen — 신규 URL 하나라도 추가 시도 (파라미터 제거형)
        for (const link of sameOriginCands) {
          const clean = link.split("?")[0];
          if (!enqueued.has(clean) && !seen.has(clean)) {
            enqueued.add(clean);
            queue.push({ url: clean, depth: item.depth + 1, from: item.url });
            break;
          }
        }
      }
      if (queued === 0) {
        // 이 페이지에서 새 링크를 못 찾은 이유 기록
        const reason =
          sameOriginCands.length === 0
            ? "동일 사이트 링크 없음 (전부 외부/서브도메인)"
            : "링크 전부 중복·해시·확장자 (신규 페이지 없음)";
        if (!notes.includes(`${item.url}: ${reason}`)) notes.push(`${item.url}: ${reason}`);
      }
    } catch (e) {
      errors.push(`${item.url}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 크롤 제한 사유 요약 (왜 depth가 안 갔는지)
  if (skippedSubdomain > 0) {
    notes.push(`서브도메인 링크 ${skippedSubdomain}개 제외 (eTLD+1=${rootEtd} 기준 허용, 그 외 외부)`);
  }
  if (skippedHash > 0) notes.push(`해시 앵커 링크 ${skippedHash}개 제외 (같은 페이지 내 이동)`);
  if (skippedPathCap > 0) notes.push(`경로 중복 샘플링 ${skippedPathCap}개 제외 (같은 메뉴 링크)`);
  if (pages.length === 1) {
    notes.push("동일 사이트 페이지를 1개도 발견하지 못함 — 사이트가 전부 외부 링크/SPA/로그인 장벽일 수 있음");
  }

  return { pages, errors, notes };
}
