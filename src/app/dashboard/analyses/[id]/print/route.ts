import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AuthError,
  SESSION_COOKIE,
  requireUserFromToken,
} from "@/lib/krds/auth";
import { AnalysisError, getAnalysisForUser } from "@/lib/krds/analyses";
import { buildHtmlReport } from "@/lib/krds/export/html-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const user = requireUserFromToken(token);
    const item = getAnalysisForUser(user, id);
    if (item.status !== "completed" || !item.report) {
      return new NextResponse(
        `<!doctype html><meta charset="utf-8"><p>리포트 미준비 (${item.status})</p><a href="/dashboard/analyses/${id}">돌아가기</a>`,
        { status: 409, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    const html = buildHtmlReport(item);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (e instanceof AnalysisError) {
      return new NextResponse(`<p>${e.message}</p>`, {
        status: e.status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new NextResponse("<p>오류</p>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
