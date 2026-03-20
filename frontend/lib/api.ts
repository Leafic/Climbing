const API_BASE = "";

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

export interface KeyObservation {
  timeSec: number;
  observation: string;
  type: "issue" | "good" | "note";
}

export interface CoachingItem {
  label: string;
  content: string;
}

export interface AnalysisResultJSON {
  summary: string;
  attemptResult?: "success" | "failure";
  skillLevel?: string;
  failReason?: string | null;
  failSegment?: FailSegment | null;
  failFrameUrl?: string | null;
  successHighlights?: string[] | null;
  keyObservations?: KeyObservation[] | null;
  coachingSuggestions?: CoachingItem[];
  postureFeedback: string[];
  footworkFeedback: string[];
  centerOfMassFeedback: string[];
  completionProbability: number;
  confidence: number;
  userFeedbackApplied: boolean;
  revisedPoints: string[];
  questionAnswer?: string | null;
  modelUsed?: string | null;
  analysisReasoning?: string | null;
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

export async function createAnalysis(
  videoId: string,
  skillLevel: string = "beginner",
  attemptResult: string = "failure"
): Promise<AnalysisJobOut> {
  const res = await fetch(`${API_BASE}/api/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId, skill_level: skillLevel, attempt_result: attemptResult }),
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

// ─── Route Analysis ───

export interface HoldPosition {
  xPct: number;
  yPct: number;
  label: string;
}

export interface RouteSuggestion {
  name: string;
  difficulty: string;
  description: string;
  holds: HoldPosition[];
  steps: string[];
  approachStrategy: string;
  keyTips: string[];
}

export interface RouteAnalysisResult {
  wallDescription: string;
  holdColor: string;
  identifiedHolds: number;
  routes: RouteSuggestion[];
  generalAdvice: string;
  confidence: number;
  modelUsed?: string;
  routeImageUrl?: string;
}

export async function analyzeRoute(
  file: File,
  holdColor: string,
  skillLevel: string = "beginner"
): Promise<RouteAnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("hold_color", holdColor);
  form.append("skill_level", skillLevel);

  const res = await fetch(`${API_BASE}/api/routes/analyze`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "루트 분석 실패");
  }
  return res.json();
}
