"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  getAnalysis,
  getHistory,
  submitFeedback,
  AnalysisDetailOut,
  AnalysisHistoryOut,
} from "@/lib/api";
import AnalysisResultCard from "@/components/AnalysisResultCard";
import TrendChart from "@/components/TrendChart";

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<AnalysisDetailOut | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryOut | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ratings, setRatings] = useState<Record<string, "good" | "bad" | null>>({});
  const [badReasons, setBadReasons] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const data = await getAnalysis(id);
      setDetail(data);
      if (data.job.status === "processing") {
        setTimeout(() => fetchData(), 2000);
        return;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await getHistory(id);
      setHistory(data);
      setShowHistory(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (detail && detail.job.current_revision > 0 && !history) {
      fetchHistory();
    }
  }, [detail]);

  const buildFeedbackText = (): string => {
    const parts: string[] = [];
    const goodItems = Object.entries(ratings).filter(([, v]) => v === "good").map(([k]) => k);
    const badItems = Object.entries(ratings).filter(([, v]) => v === "bad").map(([k]) => k);
    if (goodItems.length > 0) parts.push(`[정확했던 항목] ${goodItems.join(", ")}`);
    if (badItems.length > 0) {
      for (const item of badItems) {
        const reason = badReasons[item]?.trim();
        parts.push(reason ? `[틀렸던 항목: ${item}] ${reason}` : `[틀렸던 항목: ${item}] (사유 미입력)`);
      }
    }
    if (feedback.trim()) parts.push(`[추가 의견] ${feedback.trim()}`);
    return parts.join("\n");
  };

  const hasFeedbackContent = Object.values(ratings).some(v => v !== null) || feedback.trim();

  const handleFeedbackSubmit = async () => {
    const text = buildFeedbackText();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback(id, text);
      setFeedback("");
      setRatings({});
      setBadReasons({});
      await fetchData();
      if (showHistory) await fetchHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm">분석 결과를 불러오는 중...</p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="bg-error-container/20 rounded-2xl p-6 text-center">
        <p className="text-error text-sm">{error}</p>
        <button onClick={() => router.push("/")} className="mt-4 text-primary text-sm font-bold">
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline mb-2">분석 결과</h1>
        {detail && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">videocam</span>
              {detail.video_filename}
            </span>
            <span className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              {detail.video_duration}초
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              detail.job.status === "completed"
                ? "bg-secondary-container text-on-secondary-container"
                : detail.job.status === "failed"
                ? "bg-error-container text-on-error-container"
                : "bg-surface-container-high text-on-surface-variant"
            }`}>
              {detail.job.status}
            </span>
          </div>
        )}
      </div>

      {/* Latest Result */}
      {detail?.latest_result ? (
        <AnalysisResultCard result={detail.latest_result} isLatest />
      ) : (
        <div className="bg-surface-container-low rounded-2xl p-6 text-center text-sm text-on-surface-variant">
          아직 분석 결과가 없습니다.
        </div>
      )}

      {/* 다음 연습 포인트 */}
      {detail?.latest_result?.result_json && (() => {
        const rj = detail.latest_result.result_json;
        const issues = (rj.keyObservations || []).filter((o: any) => o.type === "issue").map((o: any) => o.observation);
        const coaching = (rj.coachingSuggestions || []).slice(0, 2).map((c: any) => c.label);
        const points = [...coaching, ...issues].slice(0, 3);
        if (points.length === 0) return null;
        return (
          <div className="bg-primary-fixed/30 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">target</span>
              다음 연습 포인트
            </h3>
            <div className="flex flex-col gap-2">
              {points.map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary font-black text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-sm text-on-surface">{p}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 개선 추이 그래프 */}
      {showHistory && history && history.results.length >= 2 && (
        <TrendChart results={history.results} />
      )}

      {/* Feedback Section */}
      {detail?.job.status === "completed" && (
        <div className="bg-surface-container-highest rounded-[2rem] p-6 flex flex-col gap-5">
          <div className="text-center">
            <h3 className="font-extrabold text-on-surface text-lg">AI의 분석이 정확했나요?</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              피드백을 주시면 더 나은 분석을 제공합니다
            </p>
          </div>

          {/* 항목별 평가 */}
          <div className="flex flex-col gap-2.5">
            {[
              { key: "요약", desc: "전체 시도 요약" },
              { key: "관찰 포인트", desc: "핵심 순간 분석" },
              { key: "자세/풋워크", desc: "자세·발 위치 피드백" },
              { key: "코칭 제안", desc: "개선 방향 제안" },
              { key: "좌우 구분", desc: "왼손/오른손, 왼발/오른발" },
              { key: "홀드 색상", desc: "홀드 색상 인식" },
            ].map((item) => (
              <div key={item.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-on-surface">{item.key}</span>
                    <span className="text-xs text-on-surface-variant ml-1.5">{item.desc}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [item.key]: prev[item.key] === "good" ? null : "good" }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                        ratings[item.key] === "good"
                          ? "bg-secondary-container ring-2 ring-secondary"
                          : "bg-surface-container-low hover:bg-surface-container"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                    </button>
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [item.key]: prev[item.key] === "bad" ? null : "bad" }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                        ratings[item.key] === "bad"
                          ? "bg-error-container ring-2 ring-error"
                          : "bg-surface-container-low hover:bg-surface-container"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">sentiment_dissatisfied</span>
                    </button>
                  </div>
                </div>
                {ratings[item.key] === "bad" && (
                  <input
                    type="text"
                    value={badReasons[item.key] || ""}
                    onChange={(e) => { if (e.target.value.length <= 200) setBadReasons(prev => ({ ...prev, [item.key]: e.target.value })); }}
                    maxLength={200}
                    placeholder={`${item.key}이(가) 어떻게 틀렸나요?`}
                    className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            ))}
          </div>

          {/* 자유 의견 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-on-surface-variant font-semibold">추가 의견 (선택)</p>
              <p className={`text-xs ${feedback.length > 450 ? "text-error" : "text-on-surface-variant"}`}>
                {feedback.length}/500
              </p>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => { if (e.target.value.length <= 500) setFeedback(e.target.value); }}
              placeholder="그 외 틀린 점이나 추가로 알려줄 것이 있다면 적어주세요"
              rows={2}
              maxLength={500}
              className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {error && (
            <div className="bg-error-container/30 rounded-xl px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <button
            onClick={handleFeedbackSubmit}
            disabled={submitting || !hasFeedbackContent}
            className="bg-primary text-on-primary py-4 rounded-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            {submitting ? "재분석 중..." : "의견 보내기"}
          </button>

          <p className="text-xs text-on-surface-variant text-center">
            rev.{detail.job.current_revision} · 평가할수록 분석 정확도가 올라갑니다
          </p>
        </div>
      )}

      {/* History Toggle */}
      <div className="flex justify-center">
        <button
          onClick={showHistory ? () => setShowHistory(false) : fetchHistory}
          className="text-sm text-primary font-bold flex items-center gap-1 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]">{showHistory ? "expand_less" : "expand_more"}</span>
          {showHistory ? "이력 닫기" : "전체 분석 이력 보기"}
        </button>
      </div>

      {/* History */}
      {showHistory && history && (
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-on-surface">분석 이력</h3>

          {history.feedbacks.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-on-surface-variant">제출한 피드백</h4>
              {history.feedbacks.map((fb) => (
                <div key={fb.id} className="bg-tertiary-container/10 rounded-xl px-4 py-3">
                  <p className="text-xs text-tertiary mb-1.5 font-semibold">
                    rev.{fb.revision_from} 기준 · {new Date(fb.created_at).toLocaleString("ko-KR")}
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed">{fb.feedback_text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {[...history.results].reverse().map((r) => (
              <AnalysisResultCard key={r.id} result={r} isLatest={r.revision === history.job.current_revision} />
            ))}
          </div>
        </div>
      )}

      {/* 같은 영상의 다른 분석 */}
      {detail && detail.related_analyses.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5 flex flex-col gap-3">
          <h3 className="font-bold text-on-surface text-sm">이 영상의 다른 분석</h3>
          <div className="flex flex-col gap-2">
            {detail.related_analyses.map((ra) => (
              <button
                key={ra.job_id}
                onClick={() => router.push(`/analysis/${ra.job_id}`)}
                className="flex items-center justify-between bg-surface-container-low hover:bg-surface-container rounded-xl px-4 py-3 transition-colors text-left active:scale-[0.98]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate font-medium">{ra.summary || "분석 결과 없음"}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {new Date(ra.created_at).toLocaleString("ko-KR")} · rev.{ra.current_revision}
                  </p>
                </div>
                {ra.completion_probability != null && (
                  <span className="text-xs font-bold text-primary ml-2 shrink-0">
                    {ra.completion_probability}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button onClick={() => router.push("/upload")} className="text-sm text-on-surface-variant font-semibold active:scale-95 transition-transform">
          새 영상 분석하기
        </button>
      </div>
    </div>
  );
}
