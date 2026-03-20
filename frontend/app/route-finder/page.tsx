"use client";

import { useState } from "react";
import { analyzeRoute, RouteAnalysisResult } from "@/lib/api";
import RouteResultCard from "@/components/RouteResultCard";

const HOLD_COLORS = [
  { value: "빨강", bg: "bg-red-500", ring: "ring-red-400" },
  { value: "파랑", bg: "bg-blue-500", ring: "ring-blue-400" },
  { value: "초록", bg: "bg-green-500", ring: "ring-green-400" },
  { value: "노랑", bg: "bg-yellow-400", ring: "ring-yellow-300" },
  { value: "주황", bg: "bg-orange-500", ring: "ring-orange-400" },
  { value: "보라", bg: "bg-purple-500", ring: "ring-purple-400" },
  { value: "분홍", bg: "bg-pink-500", ring: "ring-pink-400" },
  { value: "검정", bg: "bg-gray-900", ring: "ring-gray-700" },
  { value: "흰색", bg: "bg-white border border-gray-300", ring: "ring-gray-400" },
];

const ROUTE_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const ANALYSIS_STEPS = [
  { pct: 15, label: "이미지 업로드 중..." },
  { pct: 40, label: "홀드 색상 식별 중..." },
  { pct: 65, label: "루트 경로 분석 중..." },
  { pct: 85, label: "공략 전략 생성 중..." },
  { pct: 95, label: "마무리 중..." },
];

export default function RouteFinderPage() {
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

  // 색상 + 번호 조합으로 hold_color 생성
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
    if (!file) {
      setError("벽 사진을 선택해주세요.");
      return;
    }
    if (!selectedColor) {
      setError("홀드 색상 또는 루트 번호를 선택해주세요.");
      return;
    }

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">루트 파인더</h1>
        <p className="text-gray-500 text-sm">
          벽 사진을 올리고 도전할 루트를 선택하면 AI가 분석해드립니다.
        </p>
      </div>

      {/* 결과가 없을 때만 입력 폼 표시 */}
      {!result && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 flex flex-col gap-5">
          {/* 사진 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              벽 사진
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {preview && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
                <img src={preview} alt="벽 미리보기" className="w-full max-h-64 object-cover" />
              </div>
            )}
          </div>

          {/* 루트 정보 입력 */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                도전할 루트
              </label>
              <p className="text-xs text-gray-400 mb-3">
                홀드 색상과 번호를 함께 선택하면 인식률이 올라갑니다
              </p>
            </div>

            {/* 홀드 색상 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">홀드 색상</p>
              <div className="flex flex-wrap gap-2">
                {HOLD_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setHoldColor(holdColor === color.value ? "" : color.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                      holdColor === color.value
                        ? `border-gray-900 ring-2 ${color.ring}`
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full shrink-0 ${color.bg}`} />
                    <span className="text-gray-700 font-medium">{color.value}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setHoldColor(holdColor === "직접입력" ? "" : "직접입력"); }}
                  className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                    holdColor === "직접입력"
                      ? "border-gray-900 ring-2 ring-gray-400"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-gray-700 font-medium">직접입력</span>
                </button>
              </div>
              {holdColor === "직접입력" && (
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  placeholder="색상을 입력하세요 (예: 하늘색, 연두색)"
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {/* 루트 번호 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">루트 번호 (스티커 번호)</p>
              <div className="flex flex-wrap gap-2">
                {ROUTE_NUMBERS.map((num) => (
                  <button
                    key={num}
                    onClick={() => setRouteNumber(routeNumber === num ? "" : num)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all text-sm font-bold flex items-center justify-center ${
                      routeNumber === num
                        ? "border-gray-900 ring-2 ring-gray-400 bg-gray-100"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 시작점 힌트 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">시작점 힌트 (선택)</p>
              <input
                type="text"
                value={startHint}
                onChange={(e) => setStartHint(e.target.value)}
                placeholder="예: 왼쪽 아래 노란 홀드에 빨간 6번 스티커"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                시작 홀드의 위치나 특징을 알려주면 AI 인식 정확도가 높아집니다
              </p>
            </div>

            {/* 선택 요약 */}
            {selectedColor && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                AI에게 전달될 정보: <span className="font-semibold text-gray-900">{selectedColor}</span>
                {startHint && <span> / 시작점: <span className="font-semibold text-gray-900">{startHint}</span></span>}
              </div>
            )}
          </div>

          {/* 숙련도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              숙련도
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {([
                { value: "beginner" as const, icon: "🧗", label: "입문", desc: "상세 스텝 설명" },
                { value: "intermediate" as const, icon: "💪", label: "중급", desc: "실전 무브 중심" },
                { value: "advanced" as const, icon: "🏆", label: "상급", desc: "핵심만 간결" },
              ]).map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSkillLevel(level.value)}
                  className={`flex flex-col items-center gap-1 px-2 sm:px-4 py-3 rounded-xl border-2 transition-all ${
                    skillLevel === level.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{level.icon}</span>
                  <span className="text-sm font-semibold">{level.label}</span>
                  <span className="text-[10px] sm:text-xs text-gray-400 text-center leading-tight">{level.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 프로그레스 */}
          {loading && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-2">
                {ANALYSIS_STEPS.map((s, i) => {
                  const isDone = i < stepIdx;
                  const isActive = i === stepIdx;
                  return (
                    <div key={i} className={`flex items-center gap-2 text-sm transition-opacity ${i > stepIdx ? "opacity-30" : "opacity-100"}`}>
                      {isDone ? (
                        <span className="text-green-500 w-4 shrink-0">✓</span>
                      ) : isActive ? (
                        <span className="w-4 shrink-0 flex items-center">
                          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        </span>
                      ) : (
                        <span className="w-4 h-3 shrink-0" />
                      )}
                      <span className={isActive ? "text-emerald-700 font-medium" : isDone ? "text-gray-400 line-through" : "text-gray-400"}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${ANALYSIS_STEPS[stepIdx].pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">AI 분석에 20초~1분 정도 소요됩니다.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !file || !hasSelection}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "분석 중..." : "🗺️ 루트 분석 시작"}
          </button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          <RouteResultCard result={result} />
          <div className="flex justify-center">
            <button
              onClick={() => { setResult(null); setFile(null); setPreview(null); setHoldColor(""); setRouteNumber(""); setStartHint(""); }}
              className="text-sm text-emerald-600 underline"
            >
              다른 벽 분석하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
