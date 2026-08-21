/**
 * RADIUS PDF — HTML 인포그래픽 → Playwright print.
 * pdfkit 텍스트 덤프 폐기.
 */
import { chromium } from "playwright";
import type { AnalysisJob } from "../types";
import { buildHtmlReport } from "./html-report";
import { BRAND } from "@/lib/brand";

export async function buildPdfReport(
  job: AnalysisJob,
  opts?: { domain?: string | null },
): Promise<Buffer> {
  if (!job.report) throw new Error("report missing");

  const html = buildHtmlReport(job, {
    domain: opts?.domain,
    print: true,
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 920, height: 1280 },
    });
    // networkidle for Pretendard CDN; fallback load
    await page.setContent(html, { waitUntil: "networkidle", timeout: 45_000 }).catch(async () => {
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    });
    // layout settle
    await new Promise((r) => setTimeout(r, 250));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "12mm",
        bottom: "16mm",
        left: "10mm",
        right: "10mm",
      },
      displayHeaderFooter: true,
      headerTemplate: `<div style="width:100%;font-size:8px;color:#64748b;padding:0 12mm;font-family:sans-serif;display:flex;justify-content:space-between">
        <span>${escapeHtml(BRAND.frameworkFull)}</span>
        <span>${escapeHtml(job.title).slice(0, 48)}</span>
      </div>`,
      footerTemplate: `<div style="width:100%;font-size:8px;color:#64748b;padding:0 12mm;font-family:sans-serif;display:flex;justify-content:space-between">
        <span>${escapeHtml(job.targetUrl).slice(0, 60)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
