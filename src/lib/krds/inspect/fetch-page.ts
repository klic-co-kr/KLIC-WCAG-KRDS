/** SSRF-aware page fetch — Aditus fetch_page MVP 스타일 (정적 HTML) */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type FetchedPage = {
  url: string;
  /** 렌더된 DOM에서 추출한 링크 (JS 메뉴 포함, Playwright 렌더 시에만) */
  domLinks?: string[];
  finalUrl: string;
  status: number;
  ok: boolean;
  title: string;
  contentType: string;
  encoding: string;
  html: string;
  headers: Record<string, string>;
  fetchedAt: string;
  elapsedMs: number;
  error?: string;
  bytes: number;
};

const UA =
  "KLIC-RADIUS-Inspect/1.0 (+https://krds.klic.co.kr; Aditus-inspired static fetch)";

const MAX_BYTES = 2_500_000;
const TIMEOUT_MS = 18_000;

function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "0.0.0.0") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  if (v.includes(".")) {
    const parts = v.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`차단된 호스트: ${hostname}`);
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error(`사설 IP 차단: ${host}`);
    return;
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error(`DNS 실패: ${host}`);
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error(`사설 IP 해석 차단: ${host}→${r.address}`);
  }
}

function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

export async function fetchPage(urlStr: string): Promise<FetchedPage> {
  const started = Date.now();
  const fetchedAt = new Date().toISOString();
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return emptyFail(urlStr, "잘못된 URL", started, fetchedAt);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return emptyFail(urlStr, "http/https만 허용", started, fetchedAt);
  }

  try {
    await assertPublicHost(url.hostname);
  } catch (e) {
    return emptyFail(
      urlStr,
      e instanceof Error ? e.message : "호스트 차단",
      started,
      fetchedAt,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.5",
      },
    });

    // re-check final URL host (redirect SSRF)
    const finalUrl = res.url || url.toString();
    try {
      const fu = new URL(finalUrl);
      await assertPublicHost(fu.hostname);
    } catch (e) {
      return emptyFail(
        urlStr,
        e instanceof Error ? e.message : "리다이렉트 호스트 차단",
        started,
        fetchedAt,
        finalUrl,
      );
    }

    const headers = headersToRecord(res.headers);
    const ctype = headers["content-type"] || "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return {
        url: urlStr,
        finalUrl,
        status: res.status,
        ok: false,
        title: "",
        contentType: ctype,
        encoding: "utf-8",
        html: "",
        headers,
        fetchedAt,
        elapsedMs: Date.now() - started,
        error: `본문 초과 (${buf.byteLength}>${MAX_BYTES})`,
        bytes: buf.byteLength,
      };
    }
    const html = buf.toString("utf8");
    return {
      url: urlStr,
      finalUrl,
      status: res.status,
      ok: res.ok,
      title: extractTitle(html),
      contentType: ctype,
      encoding: /charset=([^\s;]+)/i.exec(ctype)?.[1] || "utf-8",
      html,
      headers,
      fetchedAt,
      elapsedMs: Date.now() - started,
      bytes: buf.byteLength,
    };
  } catch (e) {
    return emptyFail(
      urlStr,
      e instanceof Error ? e.message : String(e),
      started,
      fetchedAt,
    );
  } finally {
    clearTimeout(timer);
  }
}

function emptyFail(
  url: string,
  error: string,
  started: number,
  fetchedAt: string,
  finalUrl?: string,
): FetchedPage {
  return {
    url,
    finalUrl: finalUrl || url,
    status: 0,
    ok: false,
    title: "",
    contentType: "",
    encoding: "",
    html: "",
    headers: {},
    fetchedAt,
    elapsedMs: Date.now() - started,
    error,
    bytes: 0,
  };
}
