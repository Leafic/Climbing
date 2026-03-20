"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo, createAnalysis } from "@/lib/api";

const ANALYSIS_STEPS = [
  { pct: 10, label: "영상 데이터 준비 중..." },
  { pct: 30, label: "AI 모델에 전송 중..." },
  { pct: 55, label: "클라이밍 동작 분석 중..." },
  { pct: 75, label: "결과 정리 중..." },
  { pct: 90, label: "마무리 중..." },
];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [attemptResult, setAttemptResult] = useState<"failure" | "success">("failure");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "analyze" | "duplicate">("upload");
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);
  const [existingAnalysisId, setExistingAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading || step !== "analyze") {
      setAnalysisStepIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalysisStepIdx((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [loading, step]);

  const handleUpload = async () => {
    if (!file) {
      setError("영상 파일을 선택해주세요.");
      return;
    }
    if (!duration) {
      setError("영상 길이를 감지 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const dur = parseFloat(duration);
    if (isNaN(dur) || dur <= 0) {
      setError("올바른 영상 길이를 감지하지 못했습니다.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const video = await uploadVideo(file, dur);
      setVideoId(video.id);
      if (video.is_duplicate) {
        setExistingAnalysisId(video.existing_analysis_id);
        setStep("duplicate");
      } else {
        setStep("analyze");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!videoId) return;
    setError(null);
    setLoading(true);
    try {
      const job = await createAnalysis(videoId, skillLevel, attemptResult);
      router.push(`/analysis/${job.id}`);
      return;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">영상 업로드</h1>
        <p className="text-gray-500 text-sm">30초~3분 이내 클라이밍 영상을 업로드해주세요.</p>
      </div>

      {step === "upload" && (
        <>
          <details className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <summary className="text-sm font-medium text-blue-700 cursor-pointer">
              촬영 팁 보기
            </summary>
            <ul className="mt-2 text-xs text-blue-600 flex flex-col gap-1.5 pl-1">
              <li>- 벽 전체가 보이도록 정면에서 촬영</li>
              <li>- 클라이머의 손발이 잘 보이는 각도 유지</li>
              <li>- 가로(횡) 모드 촬영 권장</li>
              <li>- 조명이 밝을수록 분석 정확도 향상</li>
              <li>- 한 시도(출발~완등/낙하)만 포함</li>
            </ul>
          </details>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-4">
            {/* 파일 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                영상 파일 선택
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setDuration("");
                  if (f) {
                    const url = URL.createObjectURL(f);
                    const v = document.createElement("video");
                    v.preload = "metadata";
                    v.onloadedmetadata = () => {
                      setDuration(String(Math.round(v.duration)));
                      URL.revokeObjectURL(url);
                    };
                    v.src = url;
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <p className="mt-1 text-xs text-gray-400">
                  {file.name}{duration ? ` · ${duration}초` : " · 길이 감지 중..."}
                </p>
              )}
            </div>

            {/* 시도 결과 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이번 시도 결과
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAttemptResult("failure")}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                    attemptResult === "failure"
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">❌</span>
                  <span className="text-sm font-semibold">실패</span>
                  <span className="text-[11px] text-gray-400">다음 성공 전략 분석</span>
                </button>
                <button
                  onClick={() => setAttemptResult("success")}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                    attemptResult === "success"
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">✅</span>
                  <span className="text-sm font-semibold">성공 (완등)</span>
                  <span className="text-[11px] text-gray-400">기술 완성도 + 개선 방향</span>
                </button>
              </div>
            </div>

            {/* 숙련도 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                숙련도
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "beginner" as const, icon: "🧗", label: "입문", desc: "기본기 중심" },
                  { value: "intermediate" as const, icon: "💪", label: "중급", desc: "무브 효율" },
                  { value: "advanced" as const, icon: "🏆", label: "상급", desc: "핵심 압축" },
                ]).map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setSkillLevel(level.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all ${
                      skillLevel === level.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-lg">{level.icon}</span>
                    <span className="text-sm font-semibold">{level.label}</span>
                    <span className="text-[11px] text-gray-400">{level.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 업로드 버튼 — 항상 보이도록 sticky */}
          <div className="sticky bottom-0 bg-gray-50 pt-2 pb-3">
            <button
              onClick={handleUpload}
              disabled={loading || !file || !duration}
              className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </>
      )}

      {step === "duplicate" && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔄</span>
            <div>
              <p className="font-semibold text-gray-900">이전에 업로드한 영상이에요</p>
              <p className="text-sm text-gray-500">같은 영상을 다시 분석하거나, 이전 결과를 확인할 수 있어요.</p>
            </div>
          </div>

          {existingAnalysisId && (
            <button
              onClick={() => router.push(`/analysis/${existingAnalysisId}`)}
              className="bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors"
            >
              이전 분석 결과 보기
            </button>
          )}

          <button
            onClick={() => setStep("analyze")}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            새로 분석하기
          </button>

          <button
            onClick={() => { setStep("upload"); setVideoId(null); setExistingAnalysisId(null); }}
            className="text-sm text-gray-400 underline"
          >
            다른 영상 올리기
          </button>
        </div>
      )}

      {step === "analyze" && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-semibold text-gray-900">업로드 완료</p>
              <p className="text-sm text-gray-500">
                {attemptResult === "success" ? "✅ 완등 성공" : "❌ 실패"} ·{" "}
                {{ beginner: "입문", intermediate: "중급", advanced: "상급" }[skillLevel]} 모드로 분석합니다.
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-2">
                {ANALYSIS_STEPS.map((s, i) => {
                  const isDone = i < analysisStepIdx;
                  const isActive = i === analysisStepIdx;
                  return (
                    <div key={i} className={`flex items-center gap-2 text-sm transition-opacity ${i > analysisStepIdx ? "opacity-30" : "opacity-100"}`}>
                      {isDone ? (
                        <span className="text-green-500 w-4 shrink-0">✓</span>
                      ) : isActive ? (
                        <span className="w-4 shrink-0 flex items-center">
                          <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse inline-block" />
                        </span>
                      ) : (
                        <span className="w-4 h-3 shrink-0" />
                      )}
                      <span className={isActive ? "text-blue-700 font-medium" : isDone ? "text-gray-400 line-through" : "text-gray-400"}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${ANALYSIS_STEPS[analysisStepIdx].pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">AI 분석에 30초~1분 정도 소요됩니다.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col gap-2">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => { setError(null); handleAnalyze(); }}
                className="text-sm text-red-600 font-medium underline self-start"
              >
                다시 시도
              </button>
            </div>
          )}

          {!loading && !error && (
            <button
              onClick={handleAnalyze}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              🤖 AI 분석 시작
            </button>
          )}
          {loading && (
            <button disabled className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold opacity-50 cursor-not-allowed">
              분석 중...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
