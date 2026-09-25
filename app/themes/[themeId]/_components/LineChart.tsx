"use client";

import { useMemo, useRef, useState } from "react";

export type ChartSeries = {
  key: string;
  label: string;
  points: { x: number; y: number }[];
};

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

// The dataviz skill's validated 8-slot categorical palette (light/dark
// pairs) — order is the CVD-safety mechanism, never cycled or reordered
// per chart. Exposed as CSS custom properties so dark mode follows this
// app's existing `prefers-color-scheme`-only convention (no manual
// data-theme toggle anywhere else in the app) rather than duplicating
// that logic here.
const SERIES_VARS = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];

function nearestIndex(points: { x: number }[], targetX: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < targetX) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].x - targetX) < Math.abs(points[lo].x - targetX)) return lo - 1;
  return lo;
}

/**
 * A small, dependency-free multi-series line chart. Built for this page's
 * two uses (a multi-series rank-over-time chart, a single-series
 * review-count-over-time chart) rather than as a general-purpose
 * component — see the dataviz skill's mark specs this follows: 2px lines,
 * recessive gridlines, a legend whenever there's more than one series,
 * and a hover crosshair+tooltip (shipped by default on any line chart,
 * not optional polish).
 */
export function LineChart({
  series,
  invertY = false,
  yTickFormat = (v: number) => String(Math.round(v)),
  xTickFormat = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  emptyMessage = "No data yet.",
  yFloor,
}: {
  series: ChartSeries[];
  invertY?: boolean;
  yTickFormat?: (value: number) => string;
  xTickFormat?: (ms: number) => string;
  emptyMessage?: string;
  // Lowest value the y-axis may show — e.g. 0 for counts, so the headroom
  // padding never produces a negative tick. Omitted = unclamped (as before).
  yFloor?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const nonEmpty = series.filter((s) => s.points.length > 0);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const allX = nonEmpty.flatMap((s) => s.points.map((p) => p.x));
    const allY = nonEmpty.flatMap((s) => s.points.map((p) => p.y));
    if (allX.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const yLo = Math.min(...allY);
    const yHi = Math.max(...allY);
    // A little headroom so a flat or near-flat series isn't glued to an edge.
    const yPad = Math.max((yHi - yLo) * 0.1, 1);
    const paddedMin = yLo - yPad;
    return { xMin: Math.min(...allX), xMax: Math.max(...allX), yMin: yFloor === undefined ? paddedMin : Math.max(yFloor, paddedMin), yMax: yHi + yPad };
  }, [nonEmpty, yFloor]);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  function scaleX(x: number) {
    if (xMax === xMin) return PAD.left + plotW / 2;
    return PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
  }
  function scaleY(y: number) {
    const t = yMax === yMin ? 0.5 : (y - yMin) / (yMax - yMin);
    // invertY: a lower rank number is better, so it renders higher on the
    // chart (t=1 at the bottom normally; flip so low values sit at top).
    const flipped = invertY ? 1 - t : t;
    return PAD.top + (1 - flipped) * plotH;
  }

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

  const xTickCount = Math.min(6, Math.max(2, nonEmpty[0]?.points.length ?? 2));
  const xTickValues = Array.from({ length: xTickCount }, (_, i) => xMin + ((xMax - xMin) * i) / (xTickCount - 1));

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || nonEmpty.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const x = xMin + ((px - PAD.left) / plotW) * (xMax - xMin);
    if (px < PAD.left || px > WIDTH - PAD.right) {
      setHoverX(null);
      return;
    }
    setHoverX(x);
  }

  if (nonEmpty.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-lg border border-border-subtle text-sm text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  // The hovered point per series — nearest by x, independently, so series
  // that were checked at slightly different times (or have gaps) still
  // resolve to a sensible neighbor rather than requiring exact alignment.
  const hovered =
    hoverX === null
      ? null
      : nonEmpty.map((s, i) => {
          const idx = nearestIndex(s.points, hoverX);
          return { series: s, point: s.points[idx], color: `var(${SERIES_VARS[i % SERIES_VARS.length]})` };
        });

  return (
    <div className="theme-rank-chart">
      <style>{`
        .theme-rank-chart {
          --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100;
          --s5: #e87ba4; --s6: #008300; --s7: #4a3aa7; --s8: #e34948;
        }
        @media (prefers-color-scheme: dark) {
          .theme-rank-chart {
            --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500;
            --s5: #d55181; --s6: #008300; --s7: #9085e9; --s8: #e66767;
          }
        }
      `}</style>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverX(null)}
        >
          {/* Recessive horizontal gridlines + y-axis labels */}
          {yTickValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={scaleY(v)}
                y2={scaleY(v)}
                className="stroke-border-subtle"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={scaleY(v)} textAnchor="end" dominantBaseline="middle" className="fill-zinc-400 text-[10px]">
                {yTickFormat(v)}
              </text>
            </g>
          ))}

          {/* x-axis labels */}
          {xTickValues.map((v, i) => (
            <text key={i} x={scaleX(v)} y={HEIGHT - 8} textAnchor="middle" className="fill-zinc-400 text-[10px]">
              {xTickFormat(v)}
            </text>
          ))}

          {/* Series lines */}
          {nonEmpty.map((s, i) => {
            const d = s.points.map((p, idx) => `${idx === 0 ? "M" : "L"}${scaleX(p.x)},${scaleY(p.y)}`).join(" ");
            const color = `var(${SERIES_VARS[i % SERIES_VARS.length]})`;
            return (
              <path key={s.key} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            );
          })}

          {/* Hover crosshair + per-series dots */}
          {hovered && (
            <>
              <line
                x1={scaleX(hoverX!)}
                x2={scaleX(hoverX!)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                className="stroke-zinc-400"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              {hovered.map(({ series: s, point, color }) => (
                <circle key={s.key} cx={scaleX(point.x)} cy={scaleY(point.y)} r={4} fill={color} stroke="white" strokeWidth={1.5} />
              ))}
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${Math.min(85, Math.max(15, (scaleX(hoverX!) / WIDTH) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-1 font-medium text-zinc-500">{xTickFormat(hoverX!)}</div>
            <div className="flex flex-col gap-0.5">
              {hovered.map(({ series: s, point, color }) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-zinc-600 dark:text-zinc-300">{s.label}:</span>
                  <span className="font-medium text-zinc-950 dark:text-zinc-50">{yTickFormat(point.y)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {nonEmpty.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {nonEmpty.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(${SERIES_VARS[i % SERIES_VARS.length]})` }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
