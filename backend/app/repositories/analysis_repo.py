from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.models import AnalysisJob, AnalysisResult, AnalysisFeedback, JobStatus


def create_job(db: Session, video_id: str, user_id: str = None) -> AnalysisJob:
    job = AnalysisJob(video_id=video_id, user_id=user_id, status=JobStatus.queued)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Optional[AnalysisJob]:
    return db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()


def update_job_status(db: Session, job: AnalysisJob, status: JobStatus) -> AnalysisJob:
    job.status = status
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def increment_job_revision(db: Session, job: AnalysisJob) -> AnalysisJob:
    job.current_revision += 1
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def create_result(db: Session, job_id: str, revision: int, summary: str, result_json: dict) -> AnalysisResult:
    result = AnalysisResult(
        analysis_job_id=job_id,
        revision=revision,
        summary=summary,
        result_json=result_json,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_latest_result(db: Session, job_id: str) -> Optional[AnalysisResult]:
    return (
        db.query(AnalysisResult)
        .filter(AnalysisResult.analysis_job_id == job_id)
        .order_by(AnalysisResult.revision.desc())
        .first()
    )


def get_all_results(db: Session, job_id: str) -> List[AnalysisResult]:
    return (
        db.query(AnalysisResult)
        .filter(AnalysisResult.analysis_job_id == job_id)
        .order_by(AnalysisResult.revision.asc())
        .all()
    )


def create_feedback(db: Session, job_id: str, revision_from: int, feedback_text: str) -> AnalysisFeedback:
    fb = AnalysisFeedback(
        analysis_job_id=job_id,
        revision_from=revision_from,
        feedback_text=feedback_text,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


def get_all_feedbacks(db: Session, job_id: str) -> List[AnalysisFeedback]:
    return (
        db.query(AnalysisFeedback)
        .filter(AnalysisFeedback.analysis_job_id == job_id)
        .order_by(AnalysisFeedback.created_at.asc())
        .all()
    )
