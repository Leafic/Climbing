from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class FailSegment(BaseModel):
    startSec: float
    endSec: float
    description: str


class AnalysisResultJSON(BaseModel):
    summary: str
    failReason: str
    failSegment: FailSegment
    strategySuggestions: List[str]
    postureFeedback: List[str]
    footworkFeedback: List[str]
    centerOfMassFeedback: List[str]
    completionProbability: int
    confidence: float
    userFeedbackApplied: bool
    revisedPoints: List[str]


class AnalysisJobCreate(BaseModel):
    video_id: str
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
