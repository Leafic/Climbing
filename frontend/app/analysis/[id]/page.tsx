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
      // 아직 처리 중이면 2초 후 재시도
      if (data.job.status === "processing") {
        setTimeout(() => fetchData(), 2000);
        return; // loading 유지
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

  useEffect(() => {
    fetchData();
  }, [id]);

  // revision > 0이면 자동으로 이력 로드 (추이 그래프 표시)
  useEffect(() => {
    if (detail && detail.job.current_revision > 0 && !history) {
      fetchHistory();
    }
  }, [detail]);

  const buildFeedbackText = (): string => {
    const parts: string[] = [];

    // 항목별 평가
    const goodItems = Object.entries(ratings).filter(([, v]) => v === "good").map(([k]) => k);
    const badItems = Object.entries(ratings).filter(([, v]) => v === "bad").map(([k]) => k);

    if (goodItems.length > 0) {
      parts.push(`[정확했던 항목] ${goodItems.join(", ")}`);
    }
    if (badItems.length > 0) {
      for (const item of badItems) {
        const reason = badReasons[item]?.trim();
        if (reason) {
          parts.push(`[틀렸던 항목: ${item}] ${reason}`);
        } else {
          parts.push(`[틀렸던 항목: ${item}] (사유 미입력)`);
        }
      }
    }

    // 자유 의견
    if (feedback.trim()) {
      parts.push(`[추가 의견] ${feedback.trim()}`);
    }

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
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">분석 결과를 불러오는 중...</p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={() => router.push("/")} className="mt-4 text-blue-600 text-sm underline">
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">분석 결과</h1>
        {detail && (
          <div className="flex gap-3 text-xs text-gray-400">
            <span>📹 {detail.video_filename}</span>
            <span>⏱ {detail.video_duration}초</span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                detail.job.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : detail.job.status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {detail.job.status}
            </span>
          </div>
        )}
      </div>

      {/* Latest Result */}
      {detail?.latest_result ? (
        <AnalysisResultCard result={detail.latest_result} isLatest />
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-sm text-yellow-700">
          아직 분석 결과가 없습니다.
        </div>
      )}

      {/* 개선 추이 그래프 */}
      {showHistory && history && history.results.length >= 2 && (
        <TrendChart results={history.results} />
      )}

      {/* Feedback Section */}
      {detail?.job.status === "completed" && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">분석 평가</h3>
            <p className="text-xs text-gray-400">
              각 항목을 평가하면 다음 분석이 더 정확해집니다
            </p>
          </div>

          {/* 항목별 좋아요/싫어요 */}
          <div className="flex flex-col gap-2">
            {[
              { key: "요약", desc: "전체 시도 요약" },
              { key: "관찰 포인트", desc: "핵심 순간 분석" },
              { key: "자세/풋워크", desc: "자세·발 위치 피드백" },
              { key: "코칭 제안", desc: "개선 방향 제안" },
              { key: "좌우 구분", desc: "왼손/오른손, 왼발/오른발" },
              { key: "홀드 색상", desc: "홀드 색상 인식" },
            ].map((item) => (
              <div key={item.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{item.key}</span>
                    <span className="text-xs text-gray-400 ml-1.5">{item.desc}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [item.key]: prev[item.key] === "good" ? null : "good" }))}
                      className={`w-9 h-9 rounded-lg text-base flex items-center justify-center transition-all ${
                        ratings[item.key] === "good"
                          ? "bg-green-100 ring-2 ring-green-400"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      O
                    </button>
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [item.key]: prev[item.key] === "bad" ? null : "bad" }))}
                      className={`w-9 h-9 rounded-lg text-base flex items-center justify-center transition-all ${
                        ratings[item.key] === "bad"
                          ? "bg-red-100 ring-2 ring-red-400"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      X
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
                    className="ml-0 w-full border border-red-200 bg-red-50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                )}
              </div>
            ))}
          </div>

          {/* 자유 의견 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500">추가 의견 (선택)</p>
              <p className={`text-xs ${feedback.length > 450 ? "text-red-500" : "text-gray-400"}`}>
                {feedback.length}/500
              </p>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => { if (e.target.value.length <= 500) setFeedback(e.target.value); }}
              placeholder="그 외 틀린 점이나 추가로 알려줄 것이 있다면 적어주세요"
              rows={2}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleFeedbackSubmit}
            disabled={submitting || !hasFeedbackContent}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "재분석 중..." : "피드백 반영 재분석"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            rev.{detail.job.current_revision} · 평가할수록 분석 정확도가 올라갑니다
          </p>
        </div>
      )}

      {/* History Toggle */}
      <div className="flex justify-center">
        <button
          onClick={showHistory ? () => setShowHistory(false) : fetchHistory}
          className="text-sm text-blue-600 underline"
        >
          {showHistory ? "이력 닫기" : "📋 전체 분석 이력 보기"}
        </button>
      </div>

      {/* History */}
      {showHistory && history && (
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-gray-900">분석 이력</h3>

          {history.feedbacks.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-gray-600">제출한 피드백</h4>
              {history.feedbacks.map((fb, i) => (
                <div key={fb.id} className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
                  <p className="text-xs text-purple-400 mb-1">
                    rev.{fb.revision_from} 기준 · {new Date(fb.created_at).toLocaleString("ko-KR")}
                  </p>
                  <p className="text-sm text-purple-800">{fb.feedback_text}</p>
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

      <div className="flex justify-center pt-2">
        <button onClick={() => router.push("/upload")} className="text-sm text-gray-400 underline">
          새 영상 분석하기
        </button>
      </div>
    </div>
  );
}
