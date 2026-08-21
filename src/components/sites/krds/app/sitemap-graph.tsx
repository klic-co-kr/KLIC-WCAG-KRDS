"use client";

/** 사이트 연계도 SVG (D3 스타일) — 대시보드 상세용 React 컴포넌트 */

type SitemapNode = { url: string; label: string; depth: number; status: number };
type SitemapEdge = { from: number; to: number };
type Sitemap = { nodes: SitemapNode[]; edges: SitemapEdge[]; maxDepth: number };

const DEPTH_COLORS = ["#0b1f33", "#0080FF", "#64748b", "#c2410c"];
const DEPTH_BG = ["#0b1f33", "#dbeafe", "#f1f5f9", "#ffedd5"];
const DEPTH_TXT = ["#ffffff", "#1e3a8a", "#334155", "#7c2d12"];

export function SitemapGraph({ sitemap }: { sitemap: Sitemap }) {
  const { nodes, edges } = sitemap;
  if (!nodes || nodes.length === 0) return null;

  const W = 860;
  const H = Math.max(120, nodes.length * 26 + 60);
  const depthCount = Math.max(1, (sitemap.maxDepth ?? 0) + 1);
  const colW = W / depthCount;
  const xOf = (d: number) => Math.min(W - 90, colW * (d + 0.5) - 20);

  // depth별 y 분포
  const byDepth: number[][] = Array.from({ length: depthCount }, () => []);
  nodes.forEach((n, i) => byDepth[n.depth]?.push(i));
  const yOf = (idx: number) => {
    const d = nodes[idx].depth;
    const arr = byDepth[d] || [];
    const pos = arr.indexOf(idx);
    const span = Math.max(40, H - 60);
    return 40 + (arr.length === 1 ? span / 2 : (span * (pos + 0.5)) / arr.length);
  };

  const edgePaths = edges
    .map((e) => {
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (!a || !b) return null;
      const x1 = xOf(a.depth), y1 = yOf(e.from);
      const x2 = xOf(b.depth), y2 = yOf(e.to);
      const mx = (x1 + x2) / 2;
      return (
        <path
          key={`e${e.from}-${e.to}`}
          d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.2"
        />
      );
    })
    .filter(Boolean);

  const nodeEls = nodes.map((n, i) => {
    const x = xOf(n.depth), y = yOf(i);
    const bg = DEPTH_BG[n.depth] || "#f1f5f9";
    const fg = DEPTH_TXT[n.depth] || "#334155";
    const label = n.label.length > 26 ? n.label.slice(0, 24) + "…" : n.label;
    return (
      <g key={`n${i}`}>
        <circle cx={x} cy={y} r="9" fill={DEPTH_COLORS[n.depth] || "#64748b"} opacity="0.9" />
        <rect
          x={x + 13}
          y={y - 10}
          width={Math.min(130, label.length * 7.2 + 14)}
          height="20"
          rx="5"
          fill={bg}
          stroke={DEPTH_COLORS[n.depth] || "#64748b"}
          strokeWidth="1"
        />
        <text x={x + 20} y={y + 4} fontSize="10" fill={fg} fontWeight="600">
          {label}
        </text>
      </g>
    );
  });

  const depthLabels = Array.from({ length: depthCount }, (_, d) => {
    const n = byDepth[d]?.length || 0;
    return (
      <text
        key={`d${d}`}
        x={xOf(d)}
        y="22"
        fontSize="9"
        fill="#94a3b8"
        fontWeight="700"
        textAnchor="middle"
      >
        D{d} · {n}페이지
      </text>
    );
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          사이트 연계도{" "}
          <span className="text-xs font-normal text-muted-foreground">
            크롤 {nodes.length}페이지 · 최대 D{sitemap.maxDepth}
          </span>
        </h2>
        <span className="text-[10px] text-muted-foreground">
          노드 색 = depth · 파랑 = 방문 성공
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="사이트 연계도"
          className="min-w-[620px]"
        >
          {depthLabels}
          {edgePaths}
          {nodeEls}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        사이트 맵 — 크롤 {nodes.length}페이지 · 최대 D{sitemap.maxDepth}
      </p>
    </section>
  );
}
