"use client";

import { useEffect, useState } from "react";
import { getDevices, getDeviceDetail, DevicesResponse, DeviceDetail } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

export default function AdminPage() {
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [selected, setSelected] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myDeviceId = typeof window !== "undefined" ? getDeviceId() : "";

  useEffect(() => {
    getDevices()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDeviceClick = async (deviceId: string) => {
    try {
      const detail = await getDeviceDetail(deviceId);
      setSelected(detail);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">디바이스 트래킹</h1>
        <p className="text-gray-500 text-sm">접속 기기별 사용 현황 (개발용)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "기기 수", value: data.summary.total_devices, color: "blue" },
            { label: "전체 분석", value: data.summary.total_analyses, color: "green" },
            { label: "식별된 분석", value: data.summary.identified_analyses, color: "purple" },
            { label: "익명 분석", value: data.summary.anonymous_analyses, color: "gray" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Device List */}
      {data && data.devices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">기기 목록</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.devices.map((d) => {
              const isMe = d.device_id === myDeviceId;
              return (
                <button
                  key={d.device_id}
                  onClick={() => handleDeviceClick(d.device_id)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${
                    selected?.device_id === d.device_id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500 truncate max-w-[180px]">
                        {d.device_id.slice(0, 8)}...
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                          내 기기
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      최근: {d.last_seen ? new Date(d.last_seen).toLocaleString("ko-KR") : "-"}
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0 text-center">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{d.total_analyses}</p>
                      <p className="text-[10px] text-gray-400">분석</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-600">{d.completed_analyses}</p>
                      <p className="text-[10px] text-gray-400">완료</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-purple-600">{d.videos_uploaded}</p>
                      <p className="text-[10px] text-gray-400">영상</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data && data.devices.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-500">
          아직 식별된 기기가 없습니다. 분석을 시작하면 자동으로 추적됩니다.
        </div>
      )}

      {/* Device Detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">기기 상세</h3>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{selected.device_id}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">
              닫기
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-lg font-bold">{selected.total_analyses}</p>
              <p className="text-[10px] text-gray-500">총 분석</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-lg font-bold text-green-700">{selected.completed_analyses}</p>
              <p className="text-[10px] text-gray-500">완료</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">첫 접속</p>
              <p className="text-xs font-medium mt-1">
                {selected.first_seen ? new Date(selected.first_seen).toLocaleDateString("ko-KR") : "-"}
              </p>
            </div>
          </div>

          {/* Recurring Issues */}
          {selected.recurring_issues.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">반복 지적 패턴</h4>
              <div className="flex flex-col gap-2">
                {selected.recurring_issues.map((issue, i) => (
                  <div key={i} className="bg-red-50 rounded-lg px-3 py-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-semibold text-red-700">{issue.category}</span>
                      <span className="text-xs font-bold text-red-600">{issue.count}회</span>
                    </div>
                    {issue.examples?.map((ex: string, j: number) => (
                      <p key={j} className="text-xs text-red-800 leading-relaxed">
                        • {ex}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis History */}
          {selected.analyses.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">분석 이력</h4>
              <div className="flex flex-col gap-2">
                {selected.analyses.map((a, i) => (
                  <a
                    key={i}
                    href={`/analysis/${a.job_id}`}
                    className="bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors block"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          a.attempt_result === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {a.attempt_result === "success" ? "성공" : "실패"}
                        </span>
                        {a.completion_probability != null && (
                          <span className="text-xs text-gray-500">{a.completion_probability}%</span>
                        )}
                        {a.skill_level && (
                          <span className="text-[10px] text-gray-400">
                            {{ beginner: "입문", intermediate: "중급", advanced: "상급" }[a.skill_level] || a.skill_level}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {a.created_at ? new Date(a.created_at).toLocaleString("ko-KR") : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">{a.summary}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
