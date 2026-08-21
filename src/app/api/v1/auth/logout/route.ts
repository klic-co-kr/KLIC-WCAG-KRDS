import { NextResponse, type NextRequest } from "next/server";
import {
  getTokenFromRequest,
  logoutByToken,
  SESSION_COOKIE,
} from "@/lib/krds/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  logoutByToken(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
