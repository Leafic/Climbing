"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo, createAnalysis } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "analyze">("upload");

  const handleUpload = async () => {
    if (!file || !duration) {
      setError("파일과 영상 길이를 모두 입력해주세요.");
      return;
    }
    const dur = parseFloat(duration);
    if (isNaN(dur) || dur <= 0) {
      setError("올바른 영상 길이를 입력해주세요.");
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
      const job = await createAnalysis(videoId);
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              영상 파일 선택
            </label>
            <input
              type="file"
              accept="video/mp4,video/mov,video/avi,video/webm,.mp4,.mov,.avi,.webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-400">{file.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              영상 길이 (초)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="예: 90 (1분 30초)"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              실제 AI 연동 시 자동 감지됩니다. MVP에서는 직접 입력해주세요.
            </p>
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
              <p className="text-sm text-gray-500">영상이 서버에 저장되었습니다.</p>
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
