"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo, createAnalysis } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "expert">("beginner");
  const [attemptResult, setAttemptResult] = useState<"failure" | "success">("failure");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "analyze">("upload");

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
      setStep("analyze");
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">영상 업로드</h1>
        <p className="text-gray-500 text-sm">30초~3분 이내 클라이밍 영상을 업로드해주세요.</p>
      </div>

      {step === "upload" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
          {/* 파일 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              영상 파일 선택
            </label>
            <input
              type="file"
              accept="video/mp4,video/mov,video/avi,video/webm,.mp4,.mov,.avi,.webm"
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
              이번 시도 결과
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAttemptResult("failure")}
                className={`flex flex-col items-center gap-1 px-4 py-4 rounded-xl border-2 transition-all ${
                  attemptResult === "failure"
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">❌</span>
                <span className="text-sm font-semibold">실패</span>
                <span className="text-xs text-gray-400">다음 성공 전략 분석</span>
              </button>
              <button
                onClick={() => setAttemptResult("success")}
                className={`flex flex-col items-center gap-1 px-4 py-4 rounded-xl border-2 transition-all ${
                  attemptResult === "success"
                    ? "border-green-400 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">✅</span>
                <span className="text-sm font-semibold">성공 (완등)</span>
                <span className="text-xs text-gray-400">기술 완성도 + 개선 방향</span>
              </button>
            </div>
          </div>

          {/* 숙련도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              숙련도
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["beginner", "expert"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setSkillLevel(level)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all ${
                    skillLevel === level
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{level === "beginner" ? "🧗" : "🏆"}</span>
                  <span className="text-sm font-semibold">
                    {level === "beginner" ? "초보자" : "숙련자"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {level === "beginner" ? "4단계 상세 코칭" : "핵심 2가지 압축"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading || !file || !duration}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      )}

      {step === "analyze" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-semibold text-gray-900">업로드 완료</p>
              <p className="text-sm text-gray-500">
                {attemptResult === "success" ? "✅ 완등 성공" : "❌ 실패"} ·{" "}
                {skillLevel === "beginner" ? "초보자" : "숙련자"} 모드로 분석합니다.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "분석 요청 중..." : "🤖 AI 분석 시작"}
          </button>
        </div>
      )}
    </div>
  );
}
