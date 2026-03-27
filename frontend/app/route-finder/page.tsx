"use client";

import { useState, useRef } from "react";
import { analyzeRoute, RouteAnalysisResult } from "@/lib/api";
import RouteResultCard from "@/components/RouteResultCard";

const HOLD_COLORS = [
  { value: "빨강", label: "Red", bg: "bg-red-500", ringActive: "ring-red-500/30" },
  { value: "파랑", label: "Blue", bg: "bg-blue-500", ringActive: "ring-blue-500/30" },
  { value: "초록", label: "Green", bg: "bg-emerald-500", ringActive: "ring-emerald-500/30" },
  { value: "노랑", label: "Yellow", bg: "bg-yellow-400", ringActive: "ring-yellow-400/30" },
  { value: "주황", label: "Orange", bg: "bg-orange-500", ringActive: "ring-orange-500/30" },
  { value: "보라", label: "Purple", bg: "bg-purple-600", ringActive: "ring-purple-600/30" },
  { value: "분홍", label: "Pink", bg: "bg-pink-400", ringActive: "ring-pink-400/30" },
  { value: "검정", label: "Black", bg: "bg-zinc-900", ringActive: "ring-zinc-900/30" },
  { value: "흰색", label: "White", bg: "bg-white border border-outline-variant", ringActive: "ring-slate-200" },
];

const ROUTE_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const ANALYSIS_STEPS = [
  { pct: 15, label: "업로드", icon: "cloud_upload" },
  { pct: 40, label: "색상 식별", icon: "palette" },
  { pct: 65, label: "루트 분석", icon: "route" },
  { pct: 85, label: "전략 생성", icon: "strategy" },
  { pct: 95, label: "마무리", icon: "check_circle" },
];

export default function RouteFinderPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [holdColor, setHoldColor] = useState<string>("");
  const [routeNumber, setRouteNumber] = useState<string>("");
  const [customColor, setCustomColor] = useState<string>("");
  const [startHint, setStartHint] = useState<string>("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteAnalysisResult | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const buildRouteQuery = (): string => {
    if (holdColor === "직접입력") return customColor.trim();
    const parts: string[] = [];
    if (holdColor) parts.push(holdColor);
    if (routeNumber) parts.push(`${routeNumber}번`);
    return parts.join(" ") || "";
  };
  const selectedColor = buildRouteQuery();
  const hasSelection = holdColor || routeNumber || (holdColor === "직접입력" && customColor.trim());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) { setError("벽 사진을 선택해주세요."); return; }
    if (!selectedColor) { setError("홀드 색상 또는 루트 번호를 선택해주세요."); return; }
    setError(null);
    setLoading(true);
    setStepIdx(0);
    setResult(null);
    const interval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 4000);
    try {
      const data = await analyzeRoute(file, selectedColor, skillLevel, startHint.trim() || undefined);
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { clearInterval(interval); setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="mt-4">
        <h2 className="text-2xl font-bold font-body text-on-surface tracking-tight">
          새로운 루트 분석하기
        </h2>
        <p className="text-on-surface-variant text-sm mt-1">
          AI가 벽면 이미지를 분석하여 최적의 경로를 제안합니다.
        </p>
      </section>

      {!result && (
        <div className="flex flex-col gap-6">
          {/* 이미지 업로드 */}
          <section className="relative group">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-56 bg-surface-container-lowest border-2 border-dashed border-outline-variant/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group-hover:bg-surface-container-low cursor-pointer overflow-hidden"
            >
              {preview ? (
                <img src={preview} alt="벽 미리보기" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-on-surface">이미지 또는 영상 업로드</p>
                    <p className="text-xs text-on-surface-variant mt-1">JPG, PNG, MP4 (최대 50MB)</p>
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </section>

          {/* 홀드 색상 선택 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">분석할 홀드 색상</h3>
              <span className="text-[10px] bg-secondary-container/20 text-on-secondary-container px-2 py-0.5 rounded-full font-bold">필수 선택</span>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {HOLD_COLORS.map((color) => {
                const isActive = holdColor === color.value;
                return (
                  <button
                    key={color.value}
                    onClick={() => setHoldColor(holdColor === color.value ? "" : color.value)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-10 h-10 rounded-full ${color.bg} transition-all ${
                        isActive
                          ? `ring-4 ring-offset-2 ${color.ringActive}`
                          : "ring-2 ring-offset-2 ring-transparent group-active:ring-current"
                      }`}
                    />
                    <span className={`text-[10px] font-medium ${
                      isActive ? "text-primary font-bold" : "text-on-surface-variant"
                    }`}>
                      {color.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* 직접입력 */}
            <button
              onClick={() => setHoldColor(holdColor === "직접입력" ? "" : "직접입력")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${
                holdColor === "직접입력"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              직접입력
            </button>
            {holdColor === "직접입력" && (
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="색상을 입력하세요 (예: 하늘색, 연두색)"
                className="w-full bg-surface-container-highest rounded-2xl px-4 py-4 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              />
            )}
          </section>

          {/* 루트 번호 */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">루트 번호 (스티커 번호)</h3>
            <div className="flex flex-wrap gap-2">
              {ROUTE_NUMBERS.map((num) => (
                <button
                  key={num}
                  onClick={() => setRouteNumber(routeNumber === num ? "" : num)}
                  className={`w-11 h-11 rounded-xl transition-all text-sm font-bold flex items-center justify-center active:scale-90 ${
                    routeNumber === num
                      ? "bg-surface-container-lowest shadow-ambient ring-2 ring-primary text-primary"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </section>

          {/* 난이도 선택 */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">목표 난이도</h3>
            <div className="flex p-1 bg-surface-container rounded-xl gap-1">
              {([
                { value: "beginner" as const, label: "Beginner" },
                { value: "intermediate" as const, label: "Intermediate" },
                { value: "advanced" as const, label: "Advanced" },
              ]).map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSkillLevel(level.value)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    skillLevel === level.value
                      ? "bg-secondary text-on-secondary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </section>

          {/* 시작점 힌트 */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">시작점 힌트</h3>
            <div className="relative">
              <input
                type="text"
                value={startHint}
                onChange={(e) => setStartHint(e.target.value)}
                placeholder="예: 오른쪽 하단 큰 노란색 홀드"
                className="w-full px-4 py-4 bg-surface-container-highest border-none rounded-2xl text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all focus:outline-none"
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline">edit_note</span>
            </div>
          </section>

          {/* 요약 박스 */}
          {selectedColor && (
            <section className="bg-surface-container-low rounded-2xl p-5 border-l-4 border-secondary shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">AI 분석 준비 완료</span>
              </div>
              <p className="text-sm text-on-surface leading-relaxed">
                AI에게 전달될 정보: <span className="font-bold text-secondary">{selectedColor}</span>
                {startHint && (
                  <span> / 시작점: <span className="font-bold text-secondary">{startHint}</span></span>
                )}
              </p>
            </section>
          )}

          {/* 프로그레스 */}
          {loading && (
            <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-black text-on-surface">분석 진행 중...</p>
                  <p className="text-xs text-on-surface-variant mt-1">루트 경로를 탐색하고 있습니다</p>
                </div>
                <p className="text-3xl font-black text-secondary">{ANALYSIS_STEPS[stepIdx].pct}%</p>
              </div>
              <div className="flex items-center justify-between px-2">
                {ANALYSIS_STEPS.map((s, i) => {
                  const isDone = i < stepIdx;
                  const isActive = i === stepIdx;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 relative">
                      {i < ANALYSIS_STEPS.length - 1 && (
                        <div className={`absolute top-4 left-[calc(50%+12px)] h-0.5 ${
                          isDone ? "bg-secondary" : "bg-surface-container-high"
                        }`} style={{ width: "30px" }} />
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 transition-all duration-500 ${
                        isDone
                          ? "bg-secondary text-white ring-4 ring-secondary-container"
                          : isActive
                            ? "bg-surface-container-lowest border-4 border-secondary animate-pulse shadow-lg"
                            : "bg-surface-container-high text-on-surface-variant opacity-40"
                      }`}>
                        {isDone ? (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`text-[9px] font-semibold ${
                        isActive ? "text-secondary" : isDone ? "text-on-surface" : "text-on-surface-variant opacity-40"
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error-container/30 rounded-xl px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* CTA */}
          {!loading && (
            <section className="pb-10">
              <button
                onClick={handleAnalyze}
                disabled={!file || !hasSelection}
                className="w-full py-4 bg-secondary active:scale-95 transition-all text-on-secondary font-bold text-lg rounded-2xl flex items-center justify-center gap-3 shadow-ambient-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">search_insights</span>
                <span>루트 분석 시작</span>
              </button>
            </section>
          )}
          {loading && (
            <button disabled className="w-full py-4 bg-secondary text-on-secondary font-bold text-lg rounded-2xl opacity-50 cursor-not-allowed">
              분석 중...
            </button>
          )}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          <RouteResultCard result={result} />
          <button
            onClick={() => { setResult(null); setFile(null); setPreview(null); setHoldColor(""); setRouteNumber(""); setStartHint(""); }}
            className="w-full bg-primary text-on-primary font-bold py-5 rounded-2xl flex items-center justify-center gap-2 shadow-ambient-lg active:scale-95 transition-transform duration-200 mb-10"
          >
            <span className="material-symbols-outlined">add_a_photo</span>
            다른 벽 분석하기
          </button>
        </>
      )}
    </div>
  );
}
