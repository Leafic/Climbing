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

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<AnalysisDetailOut | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryOut | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const data = await getAnalysis(id);
      setDetail(data);
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

  const handleFeedbackSubmit = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback(id, feedback.trim());
      setFeedback("");
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

      {/* Feedback Section */}
      {detail?.job.status === "completed" && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">추가 의견 입력</h3>
            <p className="text-xs text-gray-400">
              AI 분석이 마음에 들지 않으면 추가 의견을 입력하고 재분석을 요청하세요.
            </p>
          </div>

          <div className="text-xs text-gray-400 flex flex-wrap gap-2">
            {["발 위치가 문제였어요", "무게중심이 핵심인 것 같아요", "크럭스 구간이 더 중요해요", "손 자세를 봐주세요"].map(
              (hint) => (
                <button
                  key={hint}
                  onClick={() => setFeedback(hint)}
                  className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                >
                  {hint}
                </button>
              )
            )}
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="어떤 부분이 다르게 느껴지셨나요? (예: 발 위치가 더 중요한 것 같아요)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleFeedbackSubmit}
            disabled={submitting || !feedback.trim()}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "재분석 중..." : "🔄 피드백 반영 재분석"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            rev.{detail.job.current_revision} · 최대 5회 재분석 가능
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
