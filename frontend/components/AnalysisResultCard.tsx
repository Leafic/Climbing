import { AnalysisResultJSON, AnalysisResultOut, SuccessProbabilityBreakdown } from "@/lib/api";

interface Props {
  result: AnalysisResultOut;
  isLatest?: boolean;
}

function ProbabilityBar({ value, isSuccess }: { value: number; isSuccess: boolean }) {
  const color = isSuccess
    ? value >= 80 ? "bg-green-500" : value >= 60 ? "bg-green-400" : "bg-yellow-400"
    : value >= 70 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div className={`h-3 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
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

function SuccessProbabilitySection({ breakdown, isSuccess }: { breakdown: SuccessProbabilityBreakdown; isSuccess: boolean }) {
  const items = [
    { label: "무게중심/코어 안정성",   icon: "⚖️", max: 30, data: breakdown.centerOfMass },
    { label: "홀드 제어 및 타이밍",    icon: "🤜", max: 30, data: breakdown.holdControl },
    { label: "체력 안배 및 심리 루틴", icon: "🧠", max: 20, data: breakdown.energyAndMental },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>기본 {breakdown.base}점 시작</span>
        <span className="font-semibold text-gray-700">최종: {breakdown.total}점</span>
      </div>
      {items.map(({ label, icon, max, data }) => (
        <div key={label} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">{icon} {label}</span>
            <span className={`text-xs font-bold ${isSuccess ? "text-green-600" : "text-blue-600"}`}>
              +{data.score}pt / {max}pt
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div
              className={`h-1.5 rounded-full ${isSuccess ? "bg-green-400" : "bg-blue-400"}`}
              style={{ width: `${(data.score / max) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{data.reason}</p>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisResultCard({ result, isLatest }: Props) {
  const r: AnalysisResultJSON = result.result_json;
  const isExpert = r.skillLevel === "expert";
  const isSuccess = r.attemptResult === "success";

  return (
    <div className={`bg-white rounded-xl border ${isLatest ? (isSuccess ? "border-green-300 shadow-md" : "border-blue-300 shadow-md") : "border-gray-200"} p-5 flex flex-col gap-5`}>

      {/* Header */}
      {isLatest && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 items-center">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              최신 결과 (rev.{result.revision})
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              isSuccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {isSuccess ? "✅ 완등 성공" : "❌ 실패"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {r.skillLevel && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                {isExpert ? "🏆 숙련자" : "🧗 초보자"}
              </span>
            )}
            {r.userFeedbackApplied && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                피드백 반영됨
              </span>
            )}
            {r.modelUsed && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-mono">
                {r.modelUsed}
              </span>
            )}
          </div>
        </div>
      )}
      {!isLatest && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400">rev.{result.revision}</span>
          {r.attemptResult && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isSuccess ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
            }`}>
              {isSuccess ? "✅ 성공" : "❌ 실패"}
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      <div className={`rounded-lg p-4 ${isSuccess ? "bg-green-50" : "bg-gray-50"}`}>
        <p className="text-sm text-gray-800 leading-relaxed">{r.summary}</p>
      </div>

      {/* Score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">
            📊 {isSuccess ? "기술 완성도 점수" : "다음 시도 예상 성공 확률"}
          </h4>
          <span className="text-2xl font-bold text-gray-900">{r.completionProbability}%</span>
        </div>
        <ProbabilityBar value={r.completionProbability} isSuccess={isSuccess} />
        <p className="text-xs text-gray-400 mt-1 mb-3">
          신뢰도: {Math.round(r.confidence * 100)}% · 3가지 지표 합산 결과
        </p>
        {r.successProbabilityBreakdown && (
          <SuccessProbabilitySection breakdown={r.successProbabilityBreakdown} isSuccess={isSuccess} />
        )}
      </div>

      {/* 성공: 잘된 점 */}
      {isSuccess && r.successHighlights && r.successHighlights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">🌟 이번 성공의 핵심 요인</h4>
          <div className="flex flex-col gap-2">
            {r.successHighlights.map((h, i) => (
              <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex gap-2">
                <span className="text-green-500 font-bold text-sm shrink-0">{i + 1}.</span>
                <p className="text-sm text-green-800">{h}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실패: 실패 원인 + 구간 */}
      {!isSuccess && r.failReason && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">실패 원인</h4>
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-red-700">{r.failReason}</p>
          </div>
        </div>
      )}
      {!isSuccess && r.failSegment && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">실패 구간</h4>
          <div className="bg-orange-50 border border-orange-100 rounded-lg overflow-hidden">
            {r.failFrameUrl && (
              <div className="relative">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${r.failFrameUrl}`}
                  alt="실패 구간 캡처"
                  className="w-full object-cover max-h-48"
                />
                <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  {r.failSegment.startSec}초
                </span>
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-xs text-orange-600 font-medium mb-1">
                {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
              </p>
              <p className="text-sm text-orange-800">{r.failSegment.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Coaching Suggestions */}
      {r.coachingSuggestions && r.coachingSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            🧗‍♂️ {isSuccess ? "더 높은 수준을 위한 코칭" : "맞춤형 코칭 제안"}
            <span className="ml-2 text-xs font-normal text-gray-400">
              {isExpert ? "숙련자 — 핵심 2가지 압축" : "초보자 — 4단계 상세"}
            </span>
          </h4>
          <div className="flex flex-col gap-2">
            {r.coachingSuggestions.map((s, i) => {
              const labels = isExpert
                ? ["핵심 1", "핵심 2"]
                : ["동작 및 순서", "루트 접근 전략", "반복 훈련 방법", "심리 및 타이밍"];
              return (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-bold text-blue-500 mb-1">{labels[i] ?? `${i + 1}`}</p>
                  <p className="text-sm text-blue-800 leading-relaxed">{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Q&A Answer */}
      {r.questionAnswer && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-4">
          <h4 className="text-xs font-bold text-purple-600 mb-2">💬 질문 답변</h4>
          <p className="text-sm text-purple-900 leading-relaxed">{r.questionAnswer}</p>
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
                <span>•</span><span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
