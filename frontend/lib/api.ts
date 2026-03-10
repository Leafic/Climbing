const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface VideoUploadResponse {
  id: string;
  filename: string;
  duration_seconds: number;
  created_at: string;
}

export interface AnalysisJobOut {
  id: string;
  video_id: string;
  status: string;
  current_revision: number;
  created_at: string;
  updated_at: string;
}

export interface FailSegment {
  startSec: number;
  endSec: number;
  description: string;
}

export interface AnalysisResultJSON {
  summary: string;
  failReason: string;
  failSegment: FailSegment;
  strategySuggestions: string[];
  postureFeedback: string[];
  footworkFeedback: string[];
  centerOfMassFeedback: string[];
  completionProbability: number;
  confidence: number;
  userFeedbackApplied: boolean;
  revisedPoints: string[];
}

export interface AnalysisResultOut {
  id: string;
  analysis_job_id: string;
  revision: number;
  summary: string;
  result_json: AnalysisResultJSON;
  created_at: string;
}

export interface AnalysisDetailOut {
  job: AnalysisJobOut;
  latest_result: AnalysisResultOut | null;
  video_filename: string;
  video_duration: number;
}

export interface AnalysisHistoryOut {
  job: AnalysisJobOut;
  results: AnalysisResultOut[];
  feedbacks: FeedbackOut[];
}

export interface FeedbackOut {
  id: string;
  analysis_job_id: string;
  revision_from: number;
  feedback_text: string;
  created_at: string;
}

export async function uploadVideo(
  file: File,
  durationSeconds: number
): Promise<VideoUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("duration_seconds", String(durationSeconds));

  const res = await fetch(`${API_BASE}/api/videos/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "업로드 실패");
  }
  return res.json();
}

export async function createAnalysis(videoId: string): Promise<AnalysisJobOut> {
  const res = await fetch(`${API_BASE}/api/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "분석 요청 실패");
  }
  return res.json();
}

export async function getAnalysis(analysisId: string): Promise<AnalysisDetailOut> {
  const res = await fetch(`${API_BASE}/api/analysis/${analysisId}`);
  if (!res.ok) throw new Error("분석 결과를 불러오지 못했습니다.");
  return res.json();
}

export async function submitFeedback(
  analysisId: string,
  feedbackText: string
): Promise<AnalysisResultOut> {
  const res = await fetch(`${API_BASE}/api/analysis/${analysisId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback_text: feedbackText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "피드백 제출 실패");
  }
  return res.json();
}

export async function getHistory(analysisId: string): Promise<AnalysisHistoryOut> {
  const res = await fetch(`${API_BASE}/api/analysis/${analysisId}/history`);
  if (!res.ok) throw new Error("이력을 불러오지 못했습니다.");
  return res.json();
}
