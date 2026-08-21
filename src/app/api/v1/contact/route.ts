import { NextResponse } from "next/server";
import { mutateStore } from "@/lib/krds/store";
import { newId } from "@/lib/krds/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      org?: string;
      message?: string;
    };
    if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
      return NextResponse.json(
        { error: "name, email, message 필수" },
        { status: 400 },
      );
    }
    const item = mutateStore((store) => {
      const row = {
        id: newId("inq"),
        name: body.name!.trim(),
        email: body.email!.trim(),
        org: body.org?.trim(),
        message: body.message!.trim(),
        createdAt: new Date().toISOString(),
        status: "new" as const,
      };
      store.contacts.unshift(row);
      return row;
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "문의 접수 실패" }, { status: 500 });
  }
}
