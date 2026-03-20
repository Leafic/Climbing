"use client";

import { useState, useCallback, useEffect } from "react";
import { AnalysisResultJSON, AnalysisResultOut, KeyObservation, CoachingItem } from "@/lib/api";

interface Props {
  result: AnalysisResultOut;
  isLatest?: boolean;
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light z-10 w-10 h-10 flex items-center justify-center"
      >
        ×
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ZoomableImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className || ""} cursor-zoom-in active:opacity-80 transition-opacity`}
        onClick={() => setOpen(true)}
      />
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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

function KeyObservationsSection({ observations }: { observations: KeyObservation[] }) {
  const typeConfig = {
    issue: { dot: "bg-red-500", badge: "bg-red-900/40 text-red-300", label: "문제", border: "border-red-800/30" },
    good:  { dot: "bg-green-400", badge: "bg-green-900/40 text-green-300", label: "잘됨", border: "border-green-800/30" },
    note:  { dot: "bg-gray-500", badge: "bg-gray-700 text-gray-300", label: "참고", border: "border-gray-700/30" },
  };

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">🎬 영상 핵심 관찰 포인트</p>
      <div className="flex flex-col">
        {observations.map((obs, i) => {
          const cfg = typeConfig[obs.type] ?? typeConfig.note;
          const isLast = i === observations.length - 1;
          return (
            <div key={i} className="flex gap-3">
              {/* 타임라인 선 + 점 */}
              <div className="flex flex-col items-center shrink-0 w-3">
                <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ring-2 ring-gray-900 ${cfg.dot}`} />
                {!isLast && <div className="w-px flex-1 bg-gray-700 mt-1" />}
              </div>

              {/* 내용 */}
              <div className={`pb-4 flex-1`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-white bg-gray-800 px-2 py-0.5 rounded">
                    {formatTime(obs.timeSec)}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                {obs.frameUrl ? (
                  <div className={`mt-2 rounded-lg overflow-hidden border ${cfg.border} bg-gray-800`}>
                    <ZoomableImage
                      src={obs.frameUrl}
                      alt={`${formatTime(obs.timeSec)} 캡처`}
                      className="w-full max-h-40 object-cover"
                    />
                    <p className="text-sm text-gray-300 leading-relaxed p-3">{obs.observation}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed">{obs.observation}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisResultCard({ result, isLatest }: Props) {
  const r: AnalysisResultJSON = result.result_json;
  const skillLabels: Record<string, { icon: string; text: string }> = {
    beginner: { icon: "🧗", text: "입문" },
    intermediate: { icon: "💪", text: "중급" },
    advanced: { icon: "🏆", text: "상급" },
  };
  const skill = skillLabels[r.skillLevel || "beginner"] || skillLabels.beginner;
  const isSuccess = r.attemptResult === "success";

  return (
    <div className={`bg-white rounded-xl border ${isLatest ? (isSuccess ? "border-green-300 shadow-md" : "border-blue-300 shadow-md") : "border-gray-200"} p-4 sm:p-5 flex flex-col gap-4 sm:gap-5`}>

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
                {skill.icon} {skill.text}
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
            {r.failGifUrl ? (
              <div className="relative">
                <ZoomableImage
                  src={r.failGifUrl}
                  alt="실패 구간 GIF"
                  className="w-full object-cover max-h-56"
                />
                <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
                </span>
              </div>
            ) : r.failFrameUrl ? (
              <div className="relative">
                <ZoomableImage
                  src={r.failFrameUrl}
                  alt="실패 구간 캡처"
                  className="w-full object-cover max-h-48"
                />
                <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  {r.failSegment.startSec}초
                </span>
              </div>
            ) : null}
            <div className="px-4 py-3">
              <p className="text-xs text-orange-600 font-medium mb-1">
                {r.failSegment.startSec}초 ~ {r.failSegment.endSec}초
              </p>
              <p className="text-sm text-orange-800">{r.failSegment.description}</p>
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
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <h4 className="text-xs font-bold text-slate-600 mb-1">🔍 이렇게 분석한 이유</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{r.analysisReasoning}</p>
        </div>
      )}

      {/* 코칭 제안 */}
      {r.coachingSuggestions && r.coachingSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            🧗‍♂️ {isSuccess ? "더 높은 수준을 위한 코칭" : `${skill.text} 맞춤 코칭`}
          </h4>
          <div className="flex flex-col gap-2">
            {r.coachingSuggestions.map((item: CoachingItem, i: number) => (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-xs font-bold text-blue-500 mb-1">{item.label}</p>
                <p className="text-sm text-blue-800 leading-relaxed">{item.content}</p>
              </div>
            ))}
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
