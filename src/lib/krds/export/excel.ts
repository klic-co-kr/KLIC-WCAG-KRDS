import ExcelJS from "exceljs";
import type { AnalysisJob, Finding } from "../types";
import { BRAND } from "@/lib/brand";

function filterFindings(job: AnalysisJob, domain?: string | null): Finding[] {
  const all = job.report?.findings ?? [];
  if (!domain) return all;
  return all.filter((f) => f.domain === domain);
}

export async function buildExcelReport(
  job: AnalysisJob,
  opts?: { domain?: string | null },
): Promise<Buffer> {
  const report = job.report;
  if (!report) throw new Error("report missing");

  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.productName;
  wb.created = new Date();
  wb.modified = new Date();

  // 1. 요약
  const summary = wb.addWorksheet("요약", {
    properties: { defaultColWidth: 18 },
  });
  summary.addRows([
    [`${BRAND.productName} 전문 진단 리포트`],
    ["대상 URL", job.targetUrl],
    ["제목", job.title],
    ["분석 ID", job.id],
    ["생성 시각", report.generatedAt],
    ["엔진", report.engine],
    ["종합 점수", report.overallScore],
    ["평가 규칙 수", report.evaluatedRuleCount],
    ["통과", report.passCount],
    ["위반", report.failCount],
    ["카탈로그 총 규칙", report.totalCatalogRules],
    [],
    ["경영진 요약"],
    [report.summary],
    [],
    ["도메인 스냅샷"],
    ...report.domainScores.map((d) => [
      d.label,
      `${d.score}점`,
      `통과 ${d.passed}`,
      `위반 ${d.failed}`,
      `Crit ${d.criticalFails}`,
      `Ser ${d.seriousFails}`,
    ]),
  ]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0B1F33" } };
  summary.getRow(13).font = { bold: true, size: 12 };
  summary.getColumn(1).width = 22;
  summary.getColumn(2).width = 80;

  // 2. 도메인 점수
  const domainSheet = wb.addWorksheet("도메인점수");
  domainSheet.columns = [
    { header: "domain", key: "domain", width: 14 },
    { header: "label", key: "label", width: 22 },
    { header: "totalRules", key: "totalRules", width: 12 },
    { header: "evaluated", key: "evaluated", width: 12 },
    { header: "passed", key: "passed", width: 10 },
    { header: "failed", key: "failed", width: 10 },
    { header: "score", key: "score", width: 10 },
    { header: "criticalFails", key: "criticalFails", width: 14 },
    { header: "seriousFails", key: "seriousFails", width: 14 },
  ];
  domainSheet.getRow(1).font = { bold: true };
  for (const d of report.domainScores) domainSheet.addRow(d);

  // 3. 카테고리
  const catSheet = wb.addWorksheet("카테고리");
  catSheet.columns = [
    { header: "domain", key: "domain", width: 12 },
    { header: "category", key: "category", width: 18 },
    { header: "subcategory", key: "subcategory", width: 28 },
    { header: "total", key: "total", width: 10 },
    { header: "passed", key: "passed", width: 10 },
    { header: "failed", key: "failed", width: 10 },
    { header: "score", key: "score", width: 10 },
  ];
  catSheet.getRow(1).font = { bold: true };
  for (const c of report.categoryBreakdown) catSheet.addRow(c);

  // 4. 위반 이슈
  const findings = filterFindings(job, opts?.domain);
  const findSheet = wb.addWorksheet("위반이슈");
  findSheet.columns = [
    { header: "id", key: "id", width: 18 },
    { header: "severity", key: "severity", width: 12 },
    { header: "domain", key: "domain", width: 12 },
    { header: "category", key: "category", width: 16 },
    { header: "subcategory", key: "subcategory", width: 24 },
    { header: "code", key: "code", width: 18 },
    { header: "title", key: "title", width: 40 },
    { header: "description", key: "description", width: 50 },
    { header: "recommendation", key: "recommendation", width: 50 },
    { header: "ruleId", key: "ruleId", width: 24 },
    { header: "viewport", key: "viewport", width: 12 },
  ];
  findSheet.getRow(1).font = { bold: true };
  for (const f of findings) findSheet.addRow(f);

  // severity coloring
  const sevColors: Record<string, string> = {
    critical: "FFFFCDD2",
    serious: "FFFFE0B2",
    moderate: "FFFFF9C4",
    minor: "FFF5F5F5",
  };
  findSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sev = String(row.getCell("severity").value || "");
    const fill = sevColors[sev];
    if (fill) {
      row.getCell("severity").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
    }
  });

  // 5. 로드맵
  const road = wb.addWorksheet("로드맵");
  road.columns = [
    { header: "id", key: "id", width: 12 },
    { header: "label", key: "label", width: 16 },
    { header: "summary", key: "summary", width: 48 },
    { header: "estimatedWeeks", key: "estimatedWeeks", width: 14 },
    { header: "estimatedMm", key: "estimatedMm", width: 12 },
    { header: "focus", key: "focus", width: 40 },
    { header: "coversCount", key: "coversCount", width: 12 },
  ];
  road.getRow(1).font = { bold: true };
  for (const r of report.roadmap) {
    road.addRow({
      ...r,
      focus: r.focus.join(" · "),
      coversCount: r.coversFindingIds.length,
    });
  }

  // 6. 18섹션
  const sec = wb.addWorksheet("리포트섹션");
  sec.columns = [
    { header: "number", key: "number", width: 10 },
    { header: "id", key: "id", width: 16 },
    { header: "title", key: "title", width: 36 },
    { header: "domain", key: "domain", width: 12 },
    { header: "body", key: "body", width: 70 },
  ];
  sec.getRow(1).font = { bold: true };
  for (const s of report.sections) sec.addRow(s);

  // 7. 옵션
  const opt = wb.addWorksheet("분석옵션");
  opt.addRows([
    ["includeKrds", job.options.includeKrds],
    ["includeKwcag", job.options.includeKwcag],
    ["includeSecurity", job.options.includeSecurity],
    ["includeResponsive", job.options.includeResponsive],
    ["createdAt", job.createdAt],
    ["completedAt", job.completedAt ?? ""],
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
