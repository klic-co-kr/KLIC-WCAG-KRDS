import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "klic-radius-api",
    product: BRAND.productName,
    framework: BRAND.frameworkName,
    expand: BRAND.radiusExpand,
    version: "1.0.0",
    engine: BRAND.engine,
    url: BRAND.productUrl,
    company: BRAND.companyUrl,
    time: new Date().toISOString(),
  });
}
