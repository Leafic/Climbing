"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyAnalyses, MyAnalysisItem } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

export default function AnalysesPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<MyAnalysisItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failure">("all");

  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) {
      setLoading(false);
      return;
    }
    getMyAnalyses(deviceId)
      .then((data) => {
        setAnalyses(data.analyses);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = analyses.filter((a) => {
    if (filter === "all") return true;
    return a.attempt_result === filter;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}일 전`;
    return d.toLocaleDateString("ko-KR");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm">분석 이력을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline mb-1">내 분석 이력</h1>
        <p className="text-on-surface-variant text-sm">총 {total}건의 분석</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {([
          { value: "all" as const, label: "전체" },
          { value: "failure" as const, label: "실패" },
          { value: "success" as const, label: "성공" },
        ]).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
              filter === f.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-3 block">search_off</span>
          <p className="text-on-surface-variant text-sm mb-4">
            {analyses.length === 0 ? "아직 분석 이력이 없습니다." : "해당 조건의 분석이 없습니다."}
          </p>
          {analyses.length === 0 && (
            <button
              onClick={() => router.push("/upload")}
              className="text-primary text-sm font-bold active:scale-95 transition-transform"
            >
              첫 영상 분석하러 가기
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => (
            <button
              key={a.job_id}
              onClick={() => router.push(`/analysis/${a.job_id}`)}
              className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-all"
            >
              {/* 결과 아이콘 */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                a.status !== "completed"
                  ? "bg-surface-container-high"
                  : a.attempt_result === "success"
                  ? "bg-secondary-container"
                  : "bg-error-container"
              }`}>
                <span className="material-symbols-outlined text-[24px]">
                  {a.status === "completed"
                    ? a.attempt_result === "success" ? "check_circle" : "cancel"
                    : a.status === "failed" ? "error" : "hourglass_empty"}
                </span>
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate font-semibold">
                  {a.summary || a.video_filename}
                </p>
                <div className="flex gap-2 mt-1 text-xs text-on-surface-variant">
                  <span>{formatDate(a.created_at)}</span>
                  <span>{Math.round(a.video_duration)}초</span>
                  {a.current_revision > 0 && <span>rev.{a.current_revision}</span>}
                </div>
              </div>

              {/* 완성도 */}
              {a.completion_probability != null && (
                <div className="shrink-0 text-right">
                  <p className={`text-lg font-black ${
                    a.completion_probability >= 70 ? "text-secondary" :
                    a.completion_probability >= 40 ? "text-tertiary" : "text-error"
                  }`}>
                    {a.completion_probability}%
                  </p>
                  <p className="text-[10px] text-on-surface-variant">완성도</p>
                </div>
              )}
            </button>
          ))}
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
