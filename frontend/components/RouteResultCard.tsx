import { RouteAnalysisResult, RouteSuggestion } from "@/lib/api";

interface Props {
  result: RouteAnalysisResult;
}

function RouteCard({ route, index }: { route: RouteSuggestion; index: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 루트 헤더 */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded">
            루트 {index + 1}
          </span>
          <h3 className="text-white font-semibold text-sm">{route.name}</h3>
        </div>
        <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded">
          {route.difficulty}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* 루트 설명 */}
        <p className="text-sm text-gray-600 leading-relaxed">{route.description}</p>

        {/* 스텝 바이 스텝 */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            홀드 순서
          </h4>
          <div className="flex flex-col gap-0">
            {route.steps.map((step, i) => {
              const isLast = i === route.steps.length - 1;
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-green-500 text-white"
                        : isLast
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {i + 1}
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-gray-200 min-h-3" />}
                  </div>
                  <p className={`text-sm text-gray-700 leading-relaxed ${isLast ? "pb-0" : "pb-3"}`}>
                    {step.replace(/^\d+\.\s*/, "")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 공략 전략 */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <h4 className="text-xs font-bold text-amber-700 mb-1">공략 전략</h4>
          <p className="text-sm text-amber-900 leading-relaxed">{route.approachStrategy}</p>
        </div>

        {/* 핵심 팁 */}
        {route.keyTips && route.keyTips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {route.keyTips.map((tip, i) => (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex-1 min-w-0" style={{ minWidth: "140px" }}>
                <p className="text-xs text-blue-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RouteResultCard({ result }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* 루트 표시된 벽 사진 */}
      {result.routeImageUrl && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-900 px-4 py-2">
            <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI가 분석한 루트 경로</p>
          </div>
          <img
            src={result.routeImageUrl}
            alt="루트 경로가 표시된 벽 사진"
            className="w-full object-contain"
          />
          <div className="px-4 py-2 bg-gray-50 flex gap-3 flex-wrap">
            {result.routes.map((route, i) => {
              const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500"];
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
                  <span className="text-xs text-gray-600 font-medium">{route.name} ({route.difficulty})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 벽 분석 요약 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex gap-2 items-center">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
              루트 분석 완료
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
              {result.holdColor} 홀드
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-400">
              식별된 홀드: {result.identifiedHolds}개
            </span>
            {result.modelUsed && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-mono">
                {result.modelUsed}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{result.wallDescription}</p>
      </div>

      {/* 루트 목록 */}
      {result.routes.map((route, i) => (
        <RouteCard key={i} route={route} index={i} />
      ))}

      {/* 전반적인 조언 */}
      {result.generalAdvice && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-600 mb-1">전반적인 조언</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{result.generalAdvice}</p>
        </div>
      )}
    </div>
  );
}
