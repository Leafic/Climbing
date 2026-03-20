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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">📈 시도별 개선 추이</h4>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          improved ? "bg-green-100 text-green-700" : diff === 0 ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-700"
        }`}>
          {improved ? "+" : ""}{diff}%p
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_X} y1={y(v)} x2={W - PAD_X} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray={v === 0 || v === 100 ? "0" : "4 2"} />
            <text x={PAD_X - 6} y={y(v) + 4} textAnchor="end" className="fill-gray-400" fontSize="10">{v}</text>
          </g>
        ))}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={improved ? "#22c55e" : "#ef4444"} stopOpacity="0.25" />
            <stop offset="100%" stopColor={improved ? "#22c55e" : "#ef4444"} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d={`${probLine} L${x(maxRev).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`}
          fill="url(#probGrad)"
        />

        {/* Line */}
        <path d={probLine} fill="none" stroke={improved ? "#22c55e" : "#ef4444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.prob)} r="4" fill="white" stroke={improved ? "#22c55e" : "#ef4444"} strokeWidth="2" />
            <text x={x(i)} y={y(p.prob) - 10} textAnchor="middle" className="fill-gray-700 font-semibold" fontSize="11">{p.prob}%</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400" fontSize="10">rev.{p.rev}</text>
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
        <span>초기 분석: {first}%</span>
        <span>→</span>
        <span>최신: {last}%</span>
      </div>
    </div>
  );
}
