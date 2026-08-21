import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  getTokenFromRequest,
  requireUserFromToken,
} from "@/lib/krds/auth";
import { toPublicUser } from "@/lib/krds/types";
import { readStore } from "@/lib/krds/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = requireUserFromToken(getTokenFromRequest(req));
    const store = readStore();
    const monthKey = new Date().toISOString().slice(0, 7);
    const used = store.analyses.filter(
      (a) => a.userId === user.id && a.createdAt.startsWith(monthKey),
    ).length;
    const limit = user.plan === "free" ? 3 : user.plan === "standard" ? 100 : 200;
    return NextResponse.json({
      user: toPublicUser(user),
      usage: { month: monthKey, used, limit },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
