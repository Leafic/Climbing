from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class FailSegment(BaseModel):
    startSec: float
    endSec: float
    description: str


class SuccessProbabilityItem(BaseModel):
    score: int
    reason: str


class SuccessProbabilityBreakdown(BaseModel):
    base: int = 20
    centerOfMass: SuccessProbabilityItem
    holdControl: SuccessProbabilityItem
    energyAndMental: SuccessProbabilityItem
    total: int


class AnalysisResultJSON(BaseModel):
    summary: str
    attemptResult: Optional[str] = "failure"   # "success" | "failure"
    skillLevel: Optional[str] = "beginner"
    failReason: Optional[str] = None
    failSegment: Optional[FailSegment] = None
    failFrameUrl: Optional[str] = None
    successHighlights: Optional[List[str]] = None
    successProbabilityBreakdown: Optional[SuccessProbabilityBreakdown] = None
    coachingSuggestions: Optional[List[str]] = None
    strategySuggestions: Optional[List[str]] = None
    postureFeedback: List[str]
    footworkFeedback: List[str]
    centerOfMassFeedback: List[str]
    completionProbability: int
    confidence: float
    userFeedbackApplied: bool
    revisedPoints: List[str]
    questionAnswer: Optional[str] = None
    modelUsed: Optional[str] = None


class AnalysisJobCreate(BaseModel):
    video_id: str
    skill_level: Optional[str] = "beginner"
    attempt_result: Optional[str] = "failure"
    user_id: Optional[str] = None


class AnalysisJobOut(BaseModel):
    id: str
    video_id: str
    status: str
    current_revision: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnalysisResultOut(BaseModel):
    id: str
    analysis_job_id: str
    revision: int
    summary: str
    result_json: Any
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackCreate(BaseModel):
    feedback_text: str


class FeedbackOut(BaseModel):
    id: str
    analysis_job_id: str
    revision_from: int
    feedback_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisDetailOut(BaseModel):
    job: AnalysisJobOut
    latest_result: Optional[AnalysisResultOut]
    video_filename: str
    video_duration: float


class AnalysisHistoryOut(BaseModel):
    job: AnalysisJobOut
    results: List[AnalysisResultOut]
    feedbacks: List[FeedbackOut]
