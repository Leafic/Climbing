import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.models import JobStatus
from app.repositories import analysis_repo, video_repo
from app.schemas.analysis import (
    AnalysisJobCreate,
    AnalysisJobOut,
    AnalysisDetailOut,
    AnalysisHistoryOut,
    FeedbackCreate,
    FeedbackOut,
    AnalysisResultOut,
)
from app.services.analyzer import get_analyzer
from app.utils.video_utils import extract_frame

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisJobOut)
def create_analysis(body: AnalysisJobCreate, db: Session = Depends(get_db)):
    video = video_repo.get_video(db, body.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")

    job = analysis_repo.create_job(db, video_id=video.id)
    analysis_repo.update_job_status(db, job, JobStatus.processing)

    try:
        analyzer = get_analyzer()
        result_data = analyzer.analyze(
            duration_seconds=video.duration_seconds,
            video_path=video.file_path,
            skill_level=body.skill_level or "beginner",
            attempt_result=body.attempt_result or "failure",
        )

        # 실패 구간 프레임 추출
        fail_segment = result_data.get("failSegment")
        if fail_segment and isinstance(fail_segment, dict):
            start_sec = fail_segment.get("startSec", 0)
            frame_rel = f"frames/{video.id}_{int(start_sec)}.jpg"
            frame_abs = os.path.join(UPLOAD_DIR, frame_rel)
            if extract_frame(video.file_path, start_sec, frame_abs):
                result_data["failFrameUrl"] = f"/uploads/{frame_rel}"

        analysis_repo.create_result(
            db=db,
            job_id=job.id,
            revision=0,
            summary=result_data["summary"],
            result_json=result_data,
        )
        analysis_repo.update_job_status(db, job, JobStatus.completed)
    except Exception as e:
        analysis_repo.update_job_status(db, job, JobStatus.failed)
        raise HTTPException(status_code=500, detail=f"분석 중 오류가 발생했습니다: {str(e)}")

    return job


@router.get("/{analysis_id}", response_model=AnalysisDetailOut)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    job = analysis_repo.get_job(db, analysis_id)
    if not job:
        raise HTTPException(status_code=404, detail="분석 작업을 찾을 수 없습니다.")

    latest_result = analysis_repo.get_latest_result(db, job.id)

    return AnalysisDetailOut(
        job=AnalysisJobOut.model_validate(job),
        latest_result=AnalysisResultOut.model_validate(latest_result) if latest_result else None,
        video_filename=job.video.filename,
        video_duration=job.video.duration_seconds,
    )


@router.post("/{analysis_id}/feedback", response_model=AnalysisResultOut)
def submit_feedback(analysis_id: str, body: FeedbackCreate, db: Session = Depends(get_db)):
    job = analysis_repo.get_job(db, analysis_id)
    if not job:
        raise HTTPException(status_code=404, detail="분석 작업을 찾을 수 없습니다.")

    if job.status != JobStatus.completed:
        raise HTTPException(status_code=400, detail="완료된 분석에만 피드백을 제출할 수 있습니다.")

    latest_result = analysis_repo.get_latest_result(db, job.id)
    if not latest_result:
        raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")

    feedback = analysis_repo.create_feedback(
        db=db,
        job_id=job.id,
        revision_from=job.current_revision,
        feedback_text=body.feedback_text,
    )

    analyzer = get_analyzer()
    new_result_data = analyzer.reanalyze(
        original_result=latest_result.result_json,
        feedback_text=body.feedback_text,
        revision=job.current_revision + 1,
    )

    analysis_repo.increment_job_revision(db, job)

    new_result = analysis_repo.create_result(
        db=db,
        job_id=job.id,
        revision=job.current_revision,
        summary=new_result_data["summary"],
        result_json=new_result_data,
    )

    return new_result


@router.get("/{analysis_id}/history", response_model=AnalysisHistoryOut)
def get_history(analysis_id: str, db: Session = Depends(get_db)):
    job = analysis_repo.get_job(db, analysis_id)
    if not job:
        raise HTTPException(status_code=404, detail="분석 작업을 찾을 수 없습니다.")

    results = analysis_repo.get_all_results(db, job.id)
    feedbacks = analysis_repo.get_all_feedbacks(db, job.id)

    return AnalysisHistoryOut(
        job=AnalysisJobOut.model_validate(job),
        results=[AnalysisResultOut.model_validate(r) for r in results],
        feedbacks=[FeedbackOut.model_validate(f) for f in feedbacks],
    )
