"use client";

import { AnalysisResultOut } from "@/lib/api";

interface Props {
  results: AnalysisResultOut[];
}

export default function TrendChart({ results }: Props) {
  if (results.length < 2) return null;

  const sorted = [...results].sort((a, b) => a.revision - b.revision);
  const points = sorted.map((r) => ({
    rev: r.revision,
    prob: r.result_json.completionProbability ?? 0,
    confidence: r.result_json.confidence ?? 0,
  }));

  const W = 320;
  const H = 160;
  const PAD_X = 40;
  const PAD_Y = 24;
  const PAD_B = 28;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y - PAD_B;

  const maxRev = points.length - 1;
  const x = (i: number) => PAD_X + (maxRev === 0 ? chartW / 2 : (i / maxRev) * chartW);
  const y = (v: number) => PAD_Y + chartH - (v / 100) * chartH;

  const probLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.prob).toFixed(1)}`).join(" ");

  const first = points[0].prob;
  const last = points[points.length - 1].prob;
  const diff = last - first;
  const improved = diff > 0;

  // Use CSS variable-friendly colors
  const lineColor = improved ? "var(--color-secondary)" : "var(--color-error)";
  const gridColor = "var(--color-surface-container-high)";
  const labelColor = "var(--color-outline)";
  const textColor = "var(--color-on-surface)";

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">trending_up</span>
          시도별 개선 추이
        </h4>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          improved ? "bg-secondary-container text-on-secondary-container" : diff === 0 ? "bg-surface-container-high text-on-surface-variant" : "bg-error-container text-on-error-container"
        }`}>
          {improved ? "+" : ""}{diff}%p
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_X} y1={y(v)} x2={W - PAD_X} y2={y(v)} stroke={gridColor} strokeWidth="1" strokeDasharray={v === 0 || v === 100 ? "0" : "4 2"} />
            <text x={PAD_X - 6} y={y(v) + 4} textAnchor="end" fill={labelColor} fontSize="10">{v}</text>
          </g>
        ))}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d={`${probLine} L${x(maxRev).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`}
          fill="url(#probGrad)"
        />

        {/* Line */}
        <path d={probLine} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.prob)} r="4" fill="var(--color-surface-container-lowest)" stroke={lineColor} strokeWidth="2" />
            <text x={x(i)} y={y(p.prob) - 10} textAnchor="middle" fill={textColor} fontWeight="600" fontSize="11">{p.prob}%</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fill={labelColor} fontSize="10">rev.{p.rev}</text>
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-on-surface-variant">
        <span>초기 분석: {first}%</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        <span>최신: {last}%</span>
      </div>
    </div>
  );
}
