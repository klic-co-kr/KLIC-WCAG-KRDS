/** Playwright rendered fetch — Aditus JS path 대응 (Node) */

import { chromium, type Browser, type Page } from "playwright";
import type { FetchedPage } from "./fetch-page";
import { fetchPage } from "./fetch-page";

const UA =
  "KLIC-RADIUS-Inspect/1.1 (+https://krds.klic.co.kr; Playwright render)";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
  }
  return browserPromise;
}

export async function closeInspectBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    /* ignore */
  }
  browserPromise = null;
}

export type BrowserFetchOptions = {
  timeoutMs?: number;
  waitUntil?: "domcontentloaded" | "networkidle" | "load";
  /** extra wait after load for SPA hydrate */
  settleMs?: number;
};

/**
 * SSRF: first static fetch validates host; then browser navigates same URL.
 * Private IP blocked by fetchPage assert; browser is only used after OK.
 */
export async function fetchPageRendered(
  urlStr: string,
  opts: BrowserFetchOptions = {},
): Promise<FetchedPage & { rendered: boolean; mode: "playwright" | "static-fallback" }> {
  const timeout = opts.timeoutMs ?? 25_000;
  const settle = opts.settleMs ?? 800;
  const waitUntil = opts.waitUntil ?? "domcontentloaded";

  // SSRF gate + headers baseline
  const staticPage = await fetchPage(urlStr);
  if (staticPage.error && /차단|사설|잘못된|http\/https/i.test(staticPage.error)) {
    return { ...staticPage, rendered: false, mode: "static-fallback" };
  }

  const started = Date.now();
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: UA,
      locale: "ko-KR",
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    const res = await page.goto(urlStr, { waitUntil, timeout });
    if (settle > 0) await new Promise((r) => setTimeout(r, settle));

    const finalUrl = page.url();
    // Re-validate final host is still public (redirect)
    const gate = await fetchPage(finalUrl);
    if (gate.error && /차단|사설/i.test(gate.error)) {
      await context.close();
      return {
        ...staticPage,
        error: gate.error,
        ok: false,
        rendered: false,
        mode: "static-fallback",
      };
    }

    const html = await page.content();
    // 렌더된 DOM에서 링크 추출 (JS 메뉴 포함) — 크롤 depth 확장용
    const domLinks: string[] = await page.$$eval("a[href]", (els) =>
      els
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => /^https?:\/\//i.test(h)),
    ).catch(() => []);
    const title = await page.title();
    const status = res?.status() ?? 0;
    const headers = res ? await res.allHeaders() : {};
    const hdr: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) hdr[k.toLowerCase()] = v;

    await context.close();

    return {
      url: urlStr,
      finalUrl,
      status,
      ok: status > 0 && status < 400,
      title,
      contentType: hdr["content-type"] || "text/html",
      encoding: "utf-8",
      html,
      domLinks,
      headers: Object.keys(hdr).length ? hdr : staticPage.headers,
      fetchedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      bytes: Buffer.byteLength(html, "utf8"),
      rendered: true,
      mode: "playwright",
    };
  } catch (e) {
    // fallback to static HTML already fetched
    return {
      ...staticPage,
      error: staticPage.error || (e instanceof Error ? e.message : String(e)),
      rendered: false,
      mode: "static-fallback",
      elapsedMs: Date.now() - started,
    };
  }
}

export async function withPage<T>(
  urlStr: string,
  fn: (page: Page, fetched: FetchedPage) => Promise<T>,
  opts: BrowserFetchOptions = {},
): Promise<{ result?: T; page: FetchedPage & { rendered: boolean }; error?: string }> {
  const timeout = opts.timeoutMs ?? 25_000;
  const settle = opts.settleMs ?? 800;
  const waitUntil = opts.waitUntil ?? "domcontentloaded";

  const staticPage = await fetchPage(urlStr);
  if (staticPage.error && /차단|사설|잘못된|http\/https/i.test(staticPage.error)) {
    return { page: { ...staticPage, rendered: false }, error: staticPage.error };
  }

  const started = Date.now();
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: UA,
      locale: "ko-KR",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    const res = await page.goto(urlStr, { waitUntil, timeout });
    if (settle > 0) await new Promise((r) => setTimeout(r, settle));

    const finalUrl = page.url();
    const html = await page.content();
    const title = await page.title();
    const status = res?.status() ?? 0;
    const headers = res ? await res.allHeaders() : {};
    const hdr: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) hdr[k.toLowerCase()] = v;

    const fetched: FetchedPage & { rendered: boolean } = {
      url: urlStr,
      finalUrl,
      status,
      ok: status > 0 && status < 400,
      title,
      contentType: hdr["content-type"] || "text/html",
      encoding: "utf-8",
      html,
      headers: Object.keys(hdr).length ? hdr : staticPage.headers,
      fetchedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      bytes: Buffer.byteLength(html, "utf8"),
      rendered: true,
    };

    const result = await fn(page, fetched);
    await context.close();
    return { result, page: fetched };
  } catch (e) {
    return {
      page: { ...staticPage, rendered: false },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
