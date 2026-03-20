import uuid
import enum
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST).replace(tzinfo=None)

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey,
    Text, Enum as SAEnum, JSON
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db import Base


def make_uuid():
    return str(uuid.uuid4())


class JobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=make_uuid)
    email = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=now_kst)

    videos = relationship("Video", back_populates="user")
    analysis_jobs = relationship("AnalysisJob", back_populates="user")


class Video(Base):
    __tablename__ = "videos"

    id = Column(String(36), primary_key=True, default=make_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    device_id = Column(String(64), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    duration_seconds = Column(Float, nullable=False)
    created_at = Column(DateTime, default=now_kst)

    user = relationship("User", back_populates="videos")
    analysis_jobs = relationship("AnalysisJob", back_populates="video")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String(36), primary_key=True, default=make_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    device_id = Column(String(64), nullable=True, index=True)
    video_id = Column(String(36), ForeignKey("videos.id"), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.queued, nullable=False)
    current_revision = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=now_kst)
    updated_at = Column(DateTime, default=now_kst, onupdate=now_kst)

    user = relationship("User", back_populates="analysis_jobs")
    video = relationship("Video", back_populates="analysis_jobs")
    results = relationship("AnalysisResult", back_populates="job", order_by="AnalysisResult.revision")
    feedbacks = relationship("AnalysisFeedback", back_populates="job", order_by="AnalysisFeedback.created_at")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String(36), primary_key=True, default=make_uuid)
    analysis_job_id = Column(String(36), ForeignKey("analysis_jobs.id"), nullable=False)
    revision = Column(Integer, default=0, nullable=False)
    summary = Column(Text, nullable=False)
    result_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=now_kst)

    job = relationship("AnalysisJob", back_populates="results")


class AnalysisFeedback(Base):
    __tablename__ = "analysis_feedbacks"

    id = Column(String(36), primary_key=True, default=make_uuid)
    analysis_job_id = Column(String(36), ForeignKey("analysis_jobs.id"), nullable=False)
    revision_from = Column(Integer, nullable=False)
    feedback_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=now_kst)

    job = relationship("AnalysisJob", back_populates="feedbacks")
