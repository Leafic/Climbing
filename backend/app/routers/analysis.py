import json
import logging
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
from app.utils.video_utils import extract_frame, extract_frames_batch, extract_gif

logger = logging.getLogger(__name__)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


def _build_history_context(db: Session, device_id: str | None, current_job_id: str | None = None) -> str:
    """디바이스의 이전 분석 이력을 프롬프트용 텍스트로 요약"""
    if not device_id:
        return ""
    prev_results = analysis_repo.get_device_history(db, device_id, limit=5)
    # 현재 작업 제외
    prev_results = [r for r in prev_results if r.analysis_job_id != current_job_id]
    if not prev_results:
        return ""

    lines = []
    for r in reversed(prev_results):  # 오래된 것부터
        rj = r.result_json if isinstance(r.result_json, dict) else {}
        attempt = rj.get("attemptResult", "?")
        prob = rj.get("completionProbability", "?")
        summary = rj.get("summary", "")[:80]
        fail_reason = rj.get("failReason", "")
        obs_issues = [
            o.get("observation", "")[:50]
            for o in (rj.get("keyObservations") or [])
            if isinstance(o, dict) and o.get("type") == "issue"
        ][:2]
        line = f"- [{attempt}] 성공률 {prob}% | {summary}"
        if fail_reason:
            line += f" | 실패원인: {fail_reason[:40]}"
        if obs_issues:
            line += f" | 반복문제: {'; '.join(obs_issues)}"
        lines.append(line)

    return (
        "\n[이 사용자의 이전 분석 이력]\n"
        "아래 이력을 참고하여, 반복되는 약점 패턴을 인지하고 이번 분석에 반영하세요.\n"
        "이전에 지적된 문제가 이번 영상에서도 보이면 '여전히 개선되지 않은 점'으로 강조하세요.\n"
        "이전에 지적된 문제가 개선되었으면 '개선된 점'으로 명시하세요.\n"
        + "\n".join(lines)
        + "\n"
    )


def _enrich_with_media(result_data: dict, video_path: str, video_id: str) -> dict:
    """관찰 포인트 프레임 캡처 + 실패 구간 GIF 생성."""
    # 1) keyObservation 프레임 캡처
    observations = result_data.get("keyObservations")
    if observations and isinstance(observations, list):
        timestamps = [obs["timeSec"] for obs in observations if isinstance(obs, dict) and "timeSec" in obs]
        if timestamps:
            frames_dir = os.path.join(UPLOAD_DIR, "frames")
            extracted = extract_frames_batch(video_path, timestamps, frames_dir, f"obs_{video_id}")
            ts_to_url = {ts: f"/uploads/frames/obs_{video_id}_{int(ts)}s.jpg" for ts, _ in extracted}
            for obs in observations:
                if isinstance(obs, dict) and obs.get("timeSec") in ts_to_url:
                    obs["frameUrl"] = ts_to_url[obs["timeSec"]]

    # 2) 실패 구간 프레임 + GIF
    fail_segment = result_data.get("failSegment")
    if fail_segment and isinstance(fail_segment, dict):
        start_sec = fail_segment.get("startSec", 0)
        end_sec = fail_segment.get("endSec", 0)

        # 프레임 캡처
        frame_rel = f"frames/{video_id}_{int(start_sec)}.jpg"
        frame_abs = os.path.join(UPLOAD_DIR, frame_rel)
        if extract_frame(video_path, start_sec, frame_abs):
            result_data["failFrameUrl"] = f"/uploads/{frame_rel}"

        # GIF 생성
        if end_sec > start_sec:
            gif_rel = f"gifs/{video_id}_fail.gif"
            gif_abs = os.path.join(UPLOAD_DIR, gif_rel)
            if extract_gif(video_path, start_sec, end_sec, gif_abs):
                result_data["failGifUrl"] = f"/uploads/{gif_rel}"

    return result_data

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisJobOut)
def create_analysis(body: AnalysisJobCreate, db: Session = Depends(get_db)):
    video = video_repo.get_video(db, body.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")

    job = analysis_repo.create_job(db, video_id=video.id, device_id=body.device_id)
    analysis_repo.update_job_status(db, job, JobStatus.processing)

    try:
        # 이전 분석 이력 컨텍스트 생성
        history_context = _build_history_context(db, body.device_id, current_job_id=job.id)

        analyzer = get_analyzer()
        result_data = analyzer.analyze(
            duration_seconds=video.duration_seconds,
            video_path=video.file_path,
            skill_level=body.skill_level or "beginner",
            attempt_result=body.attempt_result or "failure",
            memo=history_context if history_context else None,
        )

        # 관찰 포인트 프레임 + 실패 구간 GIF 추출
        result_data = _enrich_with_media(result_data, video.file_path, video.id)

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
        import logging
        logging.getLogger(__name__).exception("분석 실패")
        raise HTTPException(status_code=500, detail="분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")

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

    # 재분석 결과에도 프레임/GIF 추출
    video = video_repo.get_video(db, job.video_id)
    if video and video.file_path:
        new_result_data = _enrich_with_media(new_result_data, video.file_path, video.id)

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
