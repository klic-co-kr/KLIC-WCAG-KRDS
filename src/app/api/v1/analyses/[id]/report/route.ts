import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  getTokenFromRequest,
  requireUserFromToken,
} from "@/lib/krds/auth";
import { AnalysisError, getAnalysisForUser } from "@/lib/krds/analyses";
import { buildExcelReport } from "@/lib/krds/export/excel";
import { buildHtmlReport } from "@/lib/krds/export/html-report";
import { buildPdfReport } from "@/lib/krds/export/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = requireUserFromToken(getTokenFromRequest(req));
    const item = getAnalysisForUser(user, id);
    if (item.status !== "completed" || !item.report) {
      return NextResponse.json(
        { error: "리포트가 아직 준비되지 않았습니다.", status: item.status },
        { status: 409 },
      );
    }

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();
    const domain = url.searchParams.get("domain");
    let findings = item.report.findings;
    if (domain) findings = findings.filter((f) => f.domain === domain);

    if (format === "csv") {
      const lines = [
        "id,severity,domain,category,subcategory,code,title,description,recommendation,ruleId,viewport",
        ...findings.map((f) =>
          [
            f.id,
            f.severity,
            f.domain,
            csvEscape(f.category),
            csvEscape(f.subcategory),
            f.code,
            csvEscape(f.title),
            csvEscape(f.description),
            csvEscape(f.recommendation),
            f.ruleId,
            f.viewport ?? "",
          ].join(","),
        ),
      ];
      return new NextResponse("\uFEFF" + lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="klic-krds-report-${id}.csv"`,
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const buf = await buildExcelReport(item, { domain });
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="klic-krds-report-${id}.xlsx"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    if (format === "html") {
      const html = buildHtmlReport(item, {
        domain,
        baseUrl: `${url.protocol}//${url.host}`,
      });
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="klic-krds-report-${id}.html"`,
        },
      });
    }

    if (format === "pdf") {
      const buf = await buildPdfReport(item, { domain });
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="klic-krds-report-${id}.pdf"`,
          "Content-Length": String(buf.length),
        },
      });
    }

    if (format === "summary") {
      return NextResponse.json({
        taxonomy: item.report.taxonomy,
        overallScore: item.report.overallScore,
        grade: item.report.grade,
        summary: item.report.summary,
        domainScores: item.report.domainScores,
        evaluatedRuleCount: item.report.evaluatedRuleCount,
        failCount: item.report.failCount,
        passCount: item.report.passCount,
        totalCatalogRules: item.report.totalCatalogRules,
        sections: item.report.sections,
        roadmap: item.report.roadmap,
        exports: {
          html: `/api/v1/analyses/${id}/report?format=html`,
          xlsx: `/api/v1/analyses/${id}/report?format=xlsx`,
          pdf: `/api/v1/analyses/${id}/report?format=pdf`,
          csv: `/api/v1/analyses/${id}/report?format=csv`,
          printPage: `/dashboard/analyses/${id}/print`,
        },
      });
    }

    return NextResponse.json({
      report: {
        ...item.report,
        findings,
      },
      exports: {
        html: `/api/v1/analyses/${id}/report?format=html`,
        xlsx: `/api/v1/analyses/${id}/report?format=xlsx`,
        pdf: `/api/v1/analyses/${id}/report?format=pdf`,
        csv: `/api/v1/analyses/${id}/report?format=csv`,
        printPage: `/dashboard/analyses/${id}/print`,
      },
    });
  } catch (e) {
    console.error(e);
    if (e instanceof AuthError || e instanceof AnalysisError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "리포트 조회 실패" },
      { status: 500 },
    );
  }
}
