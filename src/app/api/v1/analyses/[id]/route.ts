import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  getTokenFromRequest,
  requireUserFromToken,
} from "@/lib/krds/auth";
import {
  AnalysisError,
  cancelAnalysis,
  getAnalysisForUser,
} from "@/lib/krds/analyses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = requireUserFromToken(getTokenFromRequest(req));
    const includeRuleResults =
      new URL(req.url).searchParams.get("ruleResults") === "1";
    const item = getAnalysisForUser(user, id, { includeRuleResults });
    return NextResponse.json({ item });
  } catch (e) {
    if (e instanceof AuthError || e instanceof AnalysisError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = requireUserFromToken(getTokenFromRequest(req));
    const item = cancelAnalysis(user, id);
    return NextResponse.json({ item });
  } catch (e) {
    if (e instanceof AuthError || e instanceof AnalysisError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "취소 실패" }, { status: 500 });
  }
}
