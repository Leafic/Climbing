"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyAnalyses, MyAnalysisItem } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

const TIPS = [
  { icon: "landscape", text: "벽 전체가 보이도록 촬영하면 분석이 더 정확해요" },
  { icon: "crop_landscape", text: "가로 모드로 전신을 담아보세요" },
  { icon: "light_mode", text: "밝은 조명에서 촬영하면 홀드 인식률이 올라가요" },
  { icon: "timer", text: "30초~2분 길이의 영상이 가장 좋은 분석 결과를 줘요" },
  { icon: "sports_martial_arts", text: "전신이 보이는 앵글이 발 위치 분석에 유리해요" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤에도 열정적이네요";
  if (h < 12) return "오늘도 한 단계 더";
  if (h < 18) return "오후 세션 시작";
  return "저녁 등반, 파이팅";
}

export default function HomePage() {
  const [recentAnalysis, setRecentAnalysis] = useState<MyAnalysisItem | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [tip, setTip] = useState(TIPS[0]);

  useEffect(() => {
    setGreeting(getGreeting());
    setTip(TIPS[Math.floor(Date.now() / 86400000) % TIPS.length]);
  }, []);

  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) { setLoaded(true); return; }
    getMyAnalyses(deviceId)
      .then((data) => {
        if (data.analyses.length > 0) {
          setRecentAnalysis(data.analyses[0]);
        }
        setTotalCount(data.total);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="pt-2 animate-fade-in">
        <h1 className="text-4xl font-black tracking-tight leading-[1.1] text-on-surface font-headline">
          {greeting || "\u00A0"}
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed mt-2">
          무브를 분석하고, 약점을 발견하고, 더 강해지세요.
        </p>
      </div>

      {/* 최근 분석 미리보기 */}
      {!loaded && (
        <div className="animate-fade-in stagger-1 bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-center min-h-[120px]">
          <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {loaded && recentAnalysis && (
        <Link
          href={`/analysis/${recentAnalysis.job_id}`}
          className="animate-fade-in stagger-1 bg-surface-container-lowest rounded-2xl shadow-ambient p-5 active:scale-[0.98] transition-all duration-300 block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-on-surface-variant">최근 분석</span>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              recentAnalysis.attempt_result === "success" ? "bg-secondary-container" : "bg-error-container"
            }`}>
              <span className="material-symbols-outlined text-[24px]">
                {recentAnalysis.attempt_result === "success" ? "check_circle" : "cancel"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">
                {recentAnalysis.summary || recentAnalysis.video_filename}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {Math.round(recentAnalysis.video_duration)}초
                {recentAnalysis.current_revision > 0 && ` · rev.${recentAnalysis.current_revision}`}
              </p>
            </div>
            {recentAnalysis.completion_probability != null && (
              <p className={`text-2xl font-black ${
                recentAnalysis.completion_probability >= 70 ? "text-secondary" :
                recentAnalysis.completion_probability >= 40 ? "text-tertiary" : "text-error"
              }`}>
                {recentAnalysis.completion_probability}%
              </p>
            )}
          </div>
        </Link>
      )}

      {/* 빈 상태 - 첫 사용자 가이드 */}
      {loaded && !recentAnalysis && (
        <div className="animate-fade-in stagger-1 bg-surface-container-lowest rounded-2xl shadow-ambient p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-fixed flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-[32px]">sports_martial_arts</span>
          </div>
          <p className="font-bold text-on-surface text-lg font-headline">첫 등반을 분석해보세요</p>
          <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
            영상을 업로드하면 AI가 자세, 발 위치,<br />무게중심을 분석해드려요
          </p>
          <div className="flex items-center justify-center gap-6 mt-5 text-xs text-on-surface-variant">
            <div className="flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-[20px] text-primary">videocam</span>
              <span>촬영</span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-outline-variant">arrow_forward</span>
            <div className="flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-[20px] text-primary">upload_file</span>
              <span>업로드</span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-outline-variant">arrow_forward</span>
            <div className="flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-[20px] text-primary">psychology</span>
              <span>AI 분석</span>
            </div>
          </div>
          <Link
            href="/upload"
            className="mt-5 inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            영상 업로드하기
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      )}

      {/* 주요 기능 - 비대칭 2열 */}
      <div className="grid grid-cols-2 gap-3 animate-fade-in stagger-2">
        <Link
          href="/upload"
          className="bg-primary rounded-2xl p-5 flex flex-col justify-between min-h-[140px] active:scale-[0.97] transition-all duration-300"
        >
          <span className="material-symbols-outlined text-on-primary opacity-80 text-[28px]">videocam</span>
          <div>
            <p className="font-black text-on-primary text-lg font-headline">영상 분석</p>
            <p className="text-on-primary opacity-80 text-xs mt-0.5">AI 코칭 받기</p>
          </div>
        </Link>
        <Link
          href="/route-finder"
          className="bg-secondary rounded-2xl p-5 flex flex-col justify-between min-h-[140px] active:scale-[0.97] transition-all duration-300"
        >
          <span className="material-symbols-outlined text-on-secondary opacity-80 text-[28px]">explore</span>
          <div>
            <p className="font-black text-on-secondary text-lg font-headline">루트 찾기</p>
            <p className="text-on-secondary opacity-80 text-xs mt-0.5">최적 경로</p>
          </div>
        </Link>
      </div>

      {/* 분석 이력 바로가기 (데이터 있을 때만) */}
      {loaded && totalCount > 0 && (
        <Link
          href="/analyses"
          className="animate-fade-in stagger-3 bg-surface-container-low rounded-xl p-4 flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[22px]">analytics</span>
            <div>
              <p className="text-sm font-bold text-on-surface">내 분석 이력</p>
              <p className="text-xs text-on-surface-variant">총 {totalCount}건</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
        </Link>
      )}

      {/* 빠른 팁 */}
      <div className="animate-fade-in stagger-4 bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">{tip.icon}</span>
        <div>
          <p className="text-xs font-bold text-on-surface-variant mb-0.5">촬영 팁</p>
          <p className="text-sm text-on-surface leading-relaxed">{tip.text}</p>
        </div>
      </div>
    </div>
  );
}
