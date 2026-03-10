import { AnalysisResultOut } from "@/lib/api";

interface Props {
  result: AnalysisResultOut;
  isLatest?: boolean;
}

function ProbabilityBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function FeedbackList({ items, label }: { items: string[]; label: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{label}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-600 flex gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisResultCard({ result, isLatest }: Props) {
  const r = result.result_json;

  return (
    <div className={`bg-white rounded-xl border ${isLatest ? "border-blue-300 shadow-md" : "border-gray-200"} p-5 flex flex-col gap-5`}>
      {isLatest && (
        <div className="flex items-center justify-between">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            최신 결과 (rev.{result.revision})
          </span>
          {r.userFeedbackApplied && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
              피드백 반영됨
            </span>
          )}
        </div>
      )}
      {!isLatest && (
        <span className="text-xs text-gray-400">rev.{result.revision}</span>
      )}

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-800 leading-relaxed">{r.summary}</p>
      </div>

      {/* Completion Probability */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">완등 가능성</h4>
          <span className="text-lg font-bold text-gray-900">{r.completionProbability}%</span>
        </div>
        <ProbabilityBar value={r.completionProbability} />
        <p className="text-xs text-gray-400 mt-1">
          신뢰도: {Math.round(r.confidence * 100)}% · 이 수치는 추정값입니다.
        </p>
      </div>

      {/* Fail Reason */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">실패 원인</h4>
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-red-700">{r.failReason}</p>
        </div>
      </div>

      {/* Fail Segment */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">실패 구간</h4>
        <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          <p className="text-xs text-orange-600 font-medium mb-1">
            {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
          </p>
          <p className="text-sm text-orange-800">{r.failSegment.description}</p>
        </div>
      </div>

      {/* Strategy */}
      {r.strategySuggestions && r.strategySuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">전략 제안</h4>
          <div className="flex flex-col gap-2">
            {r.strategySuggestions.map((s, i) => (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex gap-2">
                <span className="text-blue-500 font-bold text-sm shrink-0">{i + 1}.</span>
                <p className="text-sm text-blue-800">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback sections */}
      <div className="flex flex-col gap-4 pt-2 border-t border-gray-100">
        <FeedbackList items={r.postureFeedback} label="🧍 자세 피드백" />
        <FeedbackList items={r.footworkFeedback} label="🦶 발 위치 피드백" />
        <FeedbackList items={r.centerOfMassFeedback} label="⚖️ 무게중심 피드백" />
      </div>

      {/* Revised Points */}
      {r.revisedPoints && r.revisedPoints.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-purple-700 mb-2">🔄 재분석 반영 내용</h4>
          <ul className="space-y-1">
            {r.revisedPoints.map((p, i) => (
              <li key={i} className="text-xs text-purple-600 flex gap-1">
                <span>•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
