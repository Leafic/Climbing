import { AnalysisResultJSON, AnalysisResultOut, KeyObservation, CoachingItem } from "@/lib/api";

interface Props {
  result: AnalysisResultOut;
  isLatest?: boolean;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function FeedbackList({ items, label, icon }: { items: string[]; label: string; icon: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        {label}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-on-surface-variant flex gap-2 leading-relaxed">
            <span className="text-outline mt-0.5 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyObservationsSection({ observations }: { observations: KeyObservation[] }) {
  const typeConfig = {
    issue: { dot: "bg-error border-error", badge: "bg-error-container text-on-error-container", label: "문제" },
    good:  { dot: "bg-secondary border-secondary", badge: "bg-secondary-container text-on-secondary-container", label: "잘됨" },
    note:  { dot: "bg-outline border-outline", badge: "bg-surface-container-high text-on-surface-variant", label: "참고" },
  };

  return (
    <div className="bg-surface-container-low rounded-2xl p-5">
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-5 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">movie_filter</span>
        영상 핵심 관찰 포인트
      </p>
      <div className="flex flex-col pl-6 relative">
        {observations.map((obs, i) => {
          const cfg = typeConfig[obs.type] ?? typeConfig.note;
          const isLast = i === observations.length - 1;
          return (
            <div key={i} className="relative pb-5">
              {/* 세로 선 */}
              {!isLast && (
                <div className="absolute -left-[23px] top-4 bottom-0 w-[2px] bg-outline-variant/30" />
              )}
              {/* 점 */}
              <div className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 ${cfg.dot} ring-4 ring-surface-container-low`} />

              {/* 내용 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold bg-primary/5 text-primary px-2 py-0.5 rounded font-mono">
                  {formatTime(obs.timeSec)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              {obs.frameUrl ? (
                <div className="rounded-xl overflow-hidden bg-surface-container-lowest shadow-ambient">
                  <img
                    src={obs.frameUrl}
                    alt={`${formatTime(obs.timeSec)} 캡처`}
                    className="w-full max-h-40 object-cover"
                  />
                  <p className="text-sm text-on-surface-variant leading-relaxed p-3">{obs.observation}</p>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant leading-relaxed">{obs.observation}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisResultCard({ result, isLatest }: Props) {
  const r: AnalysisResultJSON = result.result_json;
  const skillLabels: Record<string, string> = {
    beginner: "입문",
    intermediate: "중급",
    advanced: "상급",
  };
  const skillText = skillLabels[r.skillLevel || "beginner"] || "입문";
  const isSuccess = r.attemptResult === "success";

  return (
    <div className={`bg-surface-container-lowest rounded-2xl shadow-ambient p-5 flex flex-col gap-5`}>

      {/* Header */}
      {isLatest && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs bg-primary-fixed text-primary px-3 py-1.5 rounded-full font-bold">
              rev.{result.revision}
            </span>
            <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
              isSuccess ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"
            }`}>
              {isSuccess ? "완등 성공" : "실패"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {r.skillLevel && (
              <span className="text-xs bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-full font-semibold">
                {skillText}
              </span>
            )}
            {r.userFeedbackApplied && (
              <span className="text-xs bg-tertiary-container/20 text-tertiary px-3 py-1.5 rounded-full font-bold">
                피드백 반영
              </span>
            )}
          </div>
        </div>
      )}
      {!isLatest && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-on-surface-variant font-semibold">rev.{result.revision}</span>
          {r.attemptResult && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              isSuccess ? "bg-secondary-container/50 text-secondary" : "bg-error-container/50 text-error"
            }`}>
              {isSuccess ? "성공" : "실패"}
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      <div className={`rounded-xl p-4 ${isSuccess ? "bg-secondary-container/10" : "bg-surface-container-low"}`}>
        <p className="text-sm text-on-surface leading-relaxed">{r.summary}</p>
      </div>

      {/* 성공: 잘된 점 */}
      {isSuccess && r.successHighlights && r.successHighlights.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">stars</span>
            이번 성공의 핵심 요인
          </h4>
          <div className="flex flex-col gap-2">
            {r.successHighlights.map((h, i) => (
              <div key={i} className="bg-secondary-container/15 rounded-xl px-4 py-3 flex gap-3">
                <span className="text-secondary font-black text-sm shrink-0">{i + 1}.</span>
                <p className="text-sm text-on-surface">{h}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실패: 실패 원인 + 구간 */}
      {!isSuccess && r.failReason && (
        <div>
          <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-error">warning</span>
            실패 원인
          </h4>
          <div className="bg-error-container/20 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-error">{r.failReason}</p>
          </div>
        </div>
      )}
      {!isSuccess && r.failSegment && (
        <div>
          <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-tertiary">timer</span>
            실패 구간
          </h4>
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            {r.failGifUrl ? (
              <div className="relative">
                <img src={r.failGifUrl} alt="실패 구간 GIF" className="w-full object-cover max-h-56" />
                <span className="absolute top-2 left-2 bg-error text-on-error text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-on-error rounded-full animate-pulse" />
                  {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
                </span>
              </div>
            ) : r.failFrameUrl ? (
              <div className="relative">
                <img src={r.failFrameUrl} alt="실패 구간 캡처" className="w-full object-cover max-h-48" />
                <span className="absolute top-2 left-2 bg-error text-on-error text-xs font-bold px-2.5 py-1 rounded-full">
                  {r.failSegment.startSec}초
                </span>
              </div>
            ) : null}
            <div className="px-4 py-3">
              <p className="text-xs text-tertiary font-bold mb-1">
                {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
              </p>
              <p className="text-sm text-on-surface-variant">{r.failSegment.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* 핵심 관찰 포인트 */}
      {r.keyObservations && r.keyObservations.length > 0 && (
        <KeyObservationsSection observations={r.keyObservations} />
      )}

      {/* 분석 근거 */}
      {r.analysisReasoning && (
        <div className="bg-surface-container-low rounded-xl px-4 py-3">
          <h4 className="text-xs font-bold text-on-surface-variant mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">search</span>
            이렇게 분석한 이유
          </h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">{r.analysisReasoning}</p>
        </div>
      )}

      {/* 코칭 제안 — Bento Grid */}
      {r.coachingSuggestions && r.coachingSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">fitness_center</span>
            AI 코칭 제안
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {r.coachingSuggestions.map((item: CoachingItem, i: number) => {
              const colors = [
                "col-span-2 bg-primary text-on-primary",
                "bg-secondary-container text-on-secondary-container",
                "bg-tertiary-container text-on-tertiary-container",
                "bg-surface-container-high text-on-surface",
                "bg-primary-fixed text-primary",
              ];
              const colorClass = colors[i % colors.length];
              return (
                <div key={i} className={`${colorClass} rounded-2xl p-4`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1.5">{item.label}</p>
                  <p className="text-sm leading-relaxed font-medium">{item.content}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Q&A Answer */}
      {r.questionAnswer && (
        <div className="bg-tertiary-container/10 rounded-xl px-4 py-4">
          <h4 className="text-xs font-bold text-tertiary mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">forum</span>
            질문 답변
          </h4>
          <p className="text-sm text-on-surface leading-relaxed">{r.questionAnswer}</p>
        </div>
      )}

      {/* Feedback sections */}
      <div className="flex flex-col gap-5 pt-4">
        <FeedbackList items={r.postureFeedback} label="자세 피드백" icon="accessibility_new" />
        <FeedbackList items={r.footworkFeedback} label="발 위치 피드백" icon="do_not_step" />
        <FeedbackList items={r.centerOfMassFeedback} label="무게중심 피드백" icon="balance" />
      </div>

      {/* Revised Points */}
      {r.revisedPoints && r.revisedPoints.length > 0 && (
        <div className="pt-3">
          <h4 className="text-xs font-bold text-tertiary mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            재분석 반영 내용
          </h4>
          <ul className="space-y-1">
            {r.revisedPoints.map((p, i) => (
              <li key={i} className="text-xs text-tertiary flex gap-1.5">
                <span>•</span><span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
