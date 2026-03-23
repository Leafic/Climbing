"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadVideo, createAnalysis } from "@/lib/api";

const ANALYSIS_STEPS = [
  { pct: 10, label: "준비", icon: "inventory_2" },
  { pct: 30, label: "전송", icon: "cloud_upload" },
  { pct: 55, label: "분석", icon: "psychology" },
  { pct: 75, label: "정리", icon: "auto_awesome" },
  { pct: 90, label: "마무리", icon: "check_circle" },
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleUpload = async () => {
    if (!file) { setError("영상 파일을 선택해주세요."); return; }
    if (!duration) { setError("영상 길이를 감지 중입니다. 잠시 후 다시 시도해주세요."); return; }
    const dur = parseFloat(duration);
    if (isNaN(dur) || dur <= 0) { setError("올바른 영상 길이를 감지하지 못했습니다."); return; }
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
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!videoId) return;
    setError(null);
    setLoading(true);
    try {
      const job = await createAnalysis(videoId, skillLevel, attemptResult);
      router.push(`/analysis/${job.id}`);
      return;
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary mb-2">
          Video Analysis
        </p>
        <h1 className="text-3xl font-black tracking-tight text-on-surface font-headline">
          등반 영상 분석
        </h1>
        <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
          AI가 당신의 무브를 분석하여 최적의 솔루션을 제공합니다.
        </p>
      </div>

      {step === "upload" && (
        <>
          {/* Bento 촬영 가이드 */}
          <div className="flex flex-col gap-3">
            <div className="bg-surface-container-lowest rounded-xl p-5 flex items-center gap-4 shadow-ambient">
              <div className="w-12 h-12 rounded-xl bg-on-surface flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-surface text-[24px]">crop_landscape</span>
              </div>
              <div>
                <p className="font-bold text-sm text-on-surface">가로 모드 권장</p>
                <p className="text-xs text-on-surface-variant mt-0.5">더 넓은 화각으로 전신을 담아주세요</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                <span className="material-symbols-outlined text-primary text-[28px] mb-3 block">landscape</span>
                <p className="font-bold text-sm text-on-surface">벽 전체 노출</p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">홀드 전체가 보여야 분석이 정확합니다</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                <span className="material-symbols-outlined text-tertiary text-[28px] mb-3 block">light_mode</span>
                <p className="font-bold text-sm text-on-surface">밝은 조명</p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">그늘진 곳 없이 밝은 환경에서 촬영</p>
              </div>
            </div>
          </div>

          {/* 파일 업로드 영역 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-b from-surface-container-low to-surface-container rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer border-2 border-dashed border-outline-variant/50 hover:border-primary/30 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined material-symbols-filled text-primary text-[32px]">upload_file</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-on-surface">영상 파일 선택</p>
              <p className="text-xs text-on-surface-variant mt-1">또는 여기로 드래그 앤 드롭</p>
            </div>
            <button
              type="button"
              className="bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-bold active:scale-95 transition-transform"
            >
              파일 찾기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {file && (
            <p className="text-xs text-on-surface-variant -mt-4 px-1">
              {file.name}{duration ? ` · ${duration}초` : " · 길이 감지 중..."}
            </p>
          )}

          {/* 시도 결과 */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              시도 결과
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setAttemptResult("success")}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                  attemptResult === "success"
                    ? "bg-primary-fixed/50 text-primary ring-2 ring-primary"
                    : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                완등 성공
              </button>
              <button
                onClick={() => setAttemptResult("failure")}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                  attemptResult === "failure"
                    ? "bg-surface-container-high text-on-surface ring-2 ring-outline"
                    : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">cancel</span>
                재도전 필요
              </button>
            </div>
          </div>

          {/* 숙련도 */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              클라이머 숙련도
            </label>
            <div className="flex gap-2">
              {([
                { value: "beginner" as const, label: "입문" },
                { value: "intermediate" as const, label: "중급" },
                { value: "advanced" as const, label: "상급" },
              ]).map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSkillLevel(level.value)}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                    skillLevel === level.value
                      ? "bg-secondary-container text-on-secondary-container ring-2 ring-secondary"
                      : "bg-surface-container-low text-on-surface-variant"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-error-container/30 rounded-xl px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleUpload}
            disabled={loading || !file || !duration}
            className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-5 rounded-2xl font-black text-base shadow-xl shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
          >
            AI 분석 시작하기
            <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
          </button>
        </>
      )}

      {step === "duplicate" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-tertiary text-[24px]">sync</span>
            </div>
            <div>
              <p className="font-bold text-on-surface">이전에 업로드한 영상이에요</p>
              <p className="text-sm text-on-surface-variant mt-0.5">같은 영상을 다시 분석하거나, 이전 결과를 확인할 수 있어요.</p>
            </div>
          </div>

          {existingAnalysisId && (
            <button
              onClick={() => router.push(`/analysis/${existingAnalysisId}`)}
              className="bg-tertiary text-on-tertiary py-4 rounded-xl font-bold active:scale-[0.98] transition-transform"
            >
              이전 분석 결과 보기
            </button>
          )}
          <button
            onClick={() => setStep("analyze")}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold active:scale-[0.98] transition-transform"
          >
            새로 분석하기
          </button>
          <button
            onClick={() => { setStep("upload"); setVideoId(null); setExistingAnalysisId(null); }}
            className="text-sm text-on-surface-variant py-2"
          >
            다른 영상 올리기
          </button>
        </div>
      )}

      {step === "analyze" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-5">
          {/* 업로드 완료 요약 */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-container/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-[24px]">check_circle</span>
            </div>
            <div>
              <p className="font-bold text-on-surface">업로드 완료</p>
              <p className="text-sm text-on-surface-variant">
                {attemptResult === "success" ? "완등 성공" : "재도전 필요"} ·{" "}
                {{ beginner: "입문", intermediate: "중급", advanced: "상급" }[skillLevel]} 모드
              </p>
            </div>
          </div>

          {/* 분석 프로그레스 */}
          {loading && (
            <div className="flex flex-col gap-5 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-black text-on-surface">분석 진행 중...</p>
                  <p className="text-xs text-on-surface-variant mt-1">정밀한 무브먼트 추출 중입니다</p>
                </div>
                <p className="text-3xl font-black text-primary">{ANALYSIS_STEPS[analysisStepIdx].pct}%</p>
              </div>

              {/* 원형 스텝 프로그레스 */}
              <div className="flex items-center justify-between px-2">
                {ANALYSIS_STEPS.map((s, i) => {
                  const isDone = i < analysisStepIdx;
                  const isActive = i === analysisStepIdx;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 relative">
                      {/* 연결 바 */}
                      {i < ANALYSIS_STEPS.length - 1 && (
                        <div className={`absolute top-4 left-[calc(50%+12px)] w-[calc(100%-8px)] h-0.5 ${
                          isDone ? "bg-primary" : "bg-surface-container-high"
                        }`} style={{ width: "40px" }} />
                      )}
                      {/* 원형 */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 transition-all duration-500 ${
                        isDone
                          ? "bg-primary text-on-primary ring-4 ring-primary-fixed"
                          : isActive
                            ? "bg-surface-container-lowest border-4 border-primary animate-pulse shadow-lg shadow-primary/30"
                            : "bg-surface-container-high text-on-surface-variant opacity-40"
                      }`}>
                        {isDone ? (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold ${
                        isActive ? "text-primary" : isDone ? "text-on-surface" : "text-on-surface-variant opacity-40"
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* AI 힌트 */}
              <div className="bg-tertiary-container/10 rounded-xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">auto_awesome</span>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  AI가 등반자의 <strong className="text-on-surface">무게 중심 이동</strong>과 <strong className="text-on-surface">홀드 유지력</strong>을 초당 60프레임으로 계산하고 있습니다.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error-container/30 rounded-xl px-4 py-3 flex flex-col gap-2">
              <p className="text-sm text-error">{error}</p>
              <button
                onClick={() => { setError(null); handleAnalyze(); }}
                className="text-sm text-error font-bold self-start"
              >
                다시 시도
              </button>
            </div>
          )}

          {!loading && !error && (
            <button
              onClick={handleAnalyze}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-5 rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              AI 분석 시작하기
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
            </button>
          )}
          {loading && (
            <button disabled className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-5 rounded-2xl font-black opacity-50 cursor-not-allowed">
              분석 중...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
