import { NextResponse, type NextRequest } from "next/server";
import { inspectUrl, type InspectMode } from "@/lib/krds/inspect";
import {
  AuthError,
  getTokenFromRequest,
  requireUserFromToken,
} from "@/lib/krds/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { url, mode?, maxPages? } */
export async function POST(req: NextRequest) {
  try {
    requireUserFromToken(getTokenFromRequest(req));
    const body = (await req.json()) as {
      url?: string;
      mode?: InspectMode;
      maxPages?: number;
    };
    if (!body.url) {
      return NextResponse.json({ error: "url 필수" }, { status: 400 });
    }
    const result = await inspectUrl(body.url, {
      mode: body.mode || "render+axe",
      maxPages: body.maxPages ?? 3,
    });
    return NextResponse.json({
      engine: result.meta.engine,
      meta: result.meta,
      page: {
        url: result.page.url,
        finalUrl: result.page.finalUrl,
        status: result.page.status,
        ok: result.page.ok,
        title: result.page.title,
        contentType: result.page.contentType,
        bytes: result.page.bytes,
        elapsedMs: result.page.elapsedMs,
        error: result.page.error,
        rendered: result.page.rendered,
        mode: result.page.mode,
        headerKeys: Object.keys(result.page.headers),
      },
      pages: result.pages.map((p) => ({
        url: p.url,
        finalUrl: p.finalUrl,
        status: p.status,
        title: p.title,
        bytes: p.bytes,
        depth: p.depth,
        rendered: p.rendered,
      })),
      axe: result.axe,
      crawlErrors: result.crawlErrors,
      summary: result.summary,
      measuredAxes: result.measuredAxes,
      hits: result.hits,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
