import { NextResponse } from "next/server";
import {
  AuthError,
  cookieOptions,
  loginUser,
  SESSION_COOKIE,
} from "@/lib/krds/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "email, password 필수" },
        { status: 400 },
      );
    }
    const result = loginUser(body.email, body.password);
    const res = NextResponse.json({
      user: result.user,
      token: result.token,
      expiresAt: result.expiresAt,
    });
    res.cookies.set(SESSION_COOKIE, result.token, cookieOptions);
    return res;
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "로그인 실패" }, { status: 500 });
  }
}
