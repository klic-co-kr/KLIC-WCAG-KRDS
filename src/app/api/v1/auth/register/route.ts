import { NextResponse } from "next/server";
import { AuthError, registerUser } from "@/lib/krds/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "email, password 필수" },
        { status: 400 },
      );
    }
    const user = registerUser({
      email: body.email,
      password: body.password,
      name: body.name ?? "",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "회원가입 실패" }, { status: 500 });
  }
}
