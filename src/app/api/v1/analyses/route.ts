import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  getTokenFromRequest,
  requireUserFromToken,
} from "@/lib/krds/auth";
import {
  AnalysisError,
  createAnalysis,
  listAnalysesForUser,
} from "@/lib/krds/analyses";
import type { RuleDomain } from "@/lib/krds/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    const user = requireUserFromToken(getTokenFromRequest(req));
    return NextResponse.json({ items: listAnalysesForUser(user) });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireUserFromToken(getTokenFromRequest(req));
    const body = (await req.json()) as {
      targetUrl?: string;
      title?: string;
      includeKrds?: boolean;
      includeKwcag?: boolean;
      includeSecurity?: boolean;
      includeResponsive?: boolean;
      axes?: Partial<Record<RuleDomain, boolean>>;
      includeCatalogSim?: boolean;
      inspectMode?: "static" | "render" | "render+axe";
      maxPages?: number;
      maxDepth?: number;
      a11yProfile?: {
        enabled?: boolean;
        keyboard?: boolean;
        contrastPanel?: boolean;
        outline?: boolean;
        targetSize?: boolean;
        media?: boolean;
        reflow?: boolean;
        scenarios?: boolean;
        maxTabs?: number;
      };
    };
    if (!body.targetUrl) {
      return NextResponse.json({ error: "targetUrl 필수" }, { status: 400 });
    }
    const job = createAnalysis(user, {
      targetUrl: body.targetUrl,
      title: body.title,
      includeKrds: body.includeKrds,
      includeKwcag: body.includeKwcag,
      includeSecurity: body.includeSecurity,
      includeResponsive: body.includeResponsive,
      axes: body.axes,
      includeCatalogSim: body.includeCatalogSim,
      inspectMode: body.inspectMode,
      maxPages: body.maxPages,
      maxDepth: body.maxDepth,
      a11yProfile: body.a11yProfile,
    });
    return NextResponse.json({ item: job }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError || e instanceof AnalysisError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "분석 생성 실패" }, { status: 500 });
  }
}
