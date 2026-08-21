import { type NextRequest } from "next/server";
import { AuthError, getTokenFromRequest, requireUserFromToken } from "@/lib/krds/auth";
import { getAnalysisForUser } from "@/lib/krds/analyses";
import {
  getAnalysisEvents,
  subscribeAnalysisEvents,
  type AnalysisEvent,
} from "@/lib/krds/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE 실시간 진행 스트림
 *
 * GET /api/v1/analyses/:id/events
 * 헤더: Authorization: Bearer <token>
 *
 * 이벤트 포맷:
 *   event: analysis.progress
 *   data: {"id":"evt_..","jobId":"anl_..","type":"inspect.axe","progress":45,"message":"..."}
 *
 * 연결 직후 버퍼된 이벤트를 모두 replay, 이후 실시간 스트림.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = requireUserFromToken(getTokenFromRequest(req));
    const job = getAnalysisForUser(user, id);

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {
          /* noop */
        }
      }
      unsubscribe = null;
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (ev: AnalysisEvent) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(
                `event: analysis.progress\ndata: ${JSON.stringify(ev)}\n\n`,
              ),
            );
          } catch {
            cleanup();
          }
        };

        // 버퍼된 이벤트 replay (연결 전 진행분 포함)
        for (const ev of getAnalysisEvents(job.id)) send(ev);

        // 실시간 구독
        unsubscribe = subscribeAnalysisEvents(job.id, (ev) => {
          send(ev);
          // 진행 중 잡이 종료 상태에 도달하면 done 전송 + 스트림 닫기
          // (이전에는 완료 이벤트를 analysis.progress로만 보내고 done을 안 보내
          //  → 클라이언트가 progress 100%에서 status running에 갇히는 버그)
          if (
            ev.type === "job.completed" ||
            ev.type === "job.failed" ||
            ev.type === "job.cancelled"
          ) {
            const status = ev.type.replace("job.", "");
            try {
              controller.enqueue(
                encoder.encode(`event: done\ndata: {"status":"${status}"}\n\n`),
              );
            } catch {
              /* noop */
            }
            cleanup();
            try {
              controller.close();
            } catch {
              /* noop */
            }
          }
        });

        // 종료 상태면 즉시 done
        if (
          job.status === "completed" ||
          job.status === "failed" ||
          job.status === "cancelled"
        ) {
          try {
            controller.enqueue(
              encoder.encode(`event: done\ndata: {"status":"${job.status}"}\n\n`),
            );
          } catch {
            /* noop */
          }
          cleanup();
          try {
            controller.close();
          } catch {
            /* noop */
          }
          return;
        }

        // heartbeat 15s
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: hb\n\n`));
          } catch {
            cleanup();
          }
        }, 15_000);
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(`event: error\ndata: {"error":"${e.message}"}\n\n`, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    return new Response(`event: error\ndata: {"error":"not found"}\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
}
