import json
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.models import JobStatus
from app.repositories import analysis_repo, video_repo, gym_repo
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
    """디바이스의 이전 분석 이력 — 원문 관찰 포인트 포함하여 구체적으로 구성"""
    if not device_id:
        return ""
    prev_results = analysis_repo.get_device_history(db, device_id, limit=3)
    prev_results = [r for r in prev_results if r.analysis_job_id != current_job_id]
    if not prev_results:
        return ""

    lines = []
    for idx, r in enumerate(reversed(prev_results), 1):  # 오래된 것부터
        rj = r.result_json if isinstance(r.result_json, dict) else {}
        attempt = rj.get("attemptResult", "failure")
        prob = rj.get("completionProbability", "?")
        fail_reason = rj.get("failReason", "")

        lines.append(f"[이전 시도 {idx}] {'성공' if attempt == 'success' else '실패'} (완성도 {prob}%)")
        if fail_reason:
            lines.append(f"  실패 원인: {fail_reason}")

        # 원문 관찰 포인트 (잘라내지 않음)
        for obs in (rj.get("keyObservations") or []):
            if isinstance(obs, dict):
                otype = obs.get("type", "note")
                text = obs.get("observation", "")
                if text:
                    tag = {"issue": "문제", "good": "잘함", "note": "참고"}.get(otype, "참고")
                    lines.append(f"  [{tag}] {text}")

    return (
        "[이 사용자의 최근 분석 이력]\n"
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

def _extract_and_save_corrections(db: Session, device_id: str, feedback_text: str):
    """피드백 텍스트에서 색상/좌우/동작 보정 패턴을 추출하여 짐 프로파일에 저장"""
    text = feedback_text.lower()
    corrections = []

    # 색상 보정 키워드
    color_keywords = ["색상", "색깔", "색이", "색은", "노란", "빨간", "파란", "초록", "주황", "보라",
                       "분홍", "검정", "흰", "하늘", "연두"]
    correction_keywords = ["아니", "틀", "잘못", "아닌데", "가 아니라", "이 아니라", "다른 색"]
    if any(ck in text for ck in color_keywords) and any(ck in text for ck in correction_keywords):
        corrections.append({"type": "color", "note": feedback_text[:100]})

    # 좌우 보정
    lr_keywords = ["왼손", "오른손", "왼발", "오른발", "왼쪽", "오른쪽"]
    if any(lk in text for lk in lr_keywords) and any(ck in text for ck in correction_keywords):
        corrections.append({"type": "direction", "note": feedback_text[:100]})

    # 동작 보정 (다이나믹 등)
    move_keywords = ["다이나믹", "정적", "랜지", "스태틱"]
    if any(mk in text for mk in move_keywords) and any(ck in text for ck in correction_keywords):
        corrections.append({"type": "move_type", "note": feedback_text[:100]})

    # 홀드 인식 보정
    hold_keywords = ["홀드", "스티커", "번호", "루트", "테이프"]
    if any(hk in text for hk in hold_keywords) and any(ck in text for ck in correction_keywords):
        corrections.append({"type": "hold_recognition", "note": feedback_text[:100]})

    # 패턴이 감지되지 않아도, 피드백 자체를 일반 보정으로 저장 (중요한 정보일 수 있음)
    if not corrections:
        corrections.append({"type": "general", "note": feedback_text[:100]})

    for c in corrections:
        gym_repo.add_correction(db, device_id, c)


def _auto_accumulate_profile(db: Session, device_id: str, result_data: dict):
    """분석 결과에서 '객관적 사실'만 자동 축적.
    약점 분석 같은 AI 판단은 틀릴 수 있으므로 자동 축적하지 않는다.
    약점은 사용자가 피드백으로 확인한 것만 축적된다."""
    try:
        profile = gym_repo.get_or_create(db, device_id)

        # ── 객관적 사실만 자동 축적 ──

        # 1. 성공/실패 기록 (사용자가 직접 선택한 값이므로 객관적)
        attempt = result_data.get("attemptResult", "failure")
        prob = result_data.get("completionProbability", 0)
        skill = result_data.get("skillLevel", "beginner")

        existing_stats = next(
            (c for c in (profile.corrections or []) if c.get("type") == "auto_stats"), None
        )
        corrections = [c for c in (profile.corrections or []) if c.get("type") != "auto_stats"]

        if existing_stats:
            total = existing_stats.get("total", 0) + 1
            successes = existing_stats.get("successes", 0) + (1 if attempt == "success" else 0)
            avg_prob = ((existing_stats.get("avg_prob", 0) * (total - 1)) + prob) / total
        else:
            total = 1
            successes = 1 if attempt == "success" else 0
            avg_prob = prob

        corrections.append({
            "type": "auto_stats",
            "total": total,
            "successes": successes,
            "success_rate": round(successes / total * 100) if total > 0 else 0,
            "avg_prob": round(avg_prob, 1),
            "last_skill": skill,
        })

        profile.corrections = corrections

        from app.models.models import now_kst
        profile.updated_at = now_kst()
        db.commit()
    except Exception:
        logger.exception("프로파일 자동 축적 실패 (무시)")


def _accumulate_verified_weakness(db: Session, device_id: str, result_data: dict):
    """피드백 후 재분석 결과에서 약점 축적.
    사용자가 피드백을 줬다 = 분석 결과를 확인했다 = 검증된 데이터."""
    try:
        weakness_categories = {
            "footwork": ["발 위치", "풋워크", "발이 미끄", "발바닥", "스미어링", "디딤", "밟", "발끝"],
            "balance": ["무게중심", "중심", "균형", "골반", "벽에서 멀", "벽에서 떨", "몸이 뒤"],
            "grip": ["그립", "손 위치", "손이 미끄", "잡지 못", "홀드를 잡"],
            "dynamic": ["다이나믹", "도약", "랜지", "데드포인트"],
            "endurance": ["지구력", "파워", "힘이 빠", "펌핑"],
            "posture": ["자세", "몸 방향", "회전", "플래깅"],
        }

        detected = set()
        for obs in (result_data.get("keyObservations") or []):
            if isinstance(obs, dict) and obs.get("type") == "issue":
                text = obs.get("observation", "")
                for cat, keywords in weakness_categories.items():
                    if any(kw in text for kw in keywords):
                        detected.add(cat)

        if not detected:
            return

        profile = gym_repo.get_or_create(db, device_id)

        # 기존 verified_weakness 카운터 로드
        weakness_counts = {}
        for c in (profile.corrections or []):
            if c.get("type") == "verified_weakness":
                weakness_counts[c["category"]] = c.get("count", 0)

        for cat in detected:
            weakness_counts[cat] = weakness_counts.get(cat, 0) + 1

        # 교체
        other = [c for c in (profile.corrections or []) if c.get("type") != "verified_weakness"]
        verified = [
            {"type": "verified_weakness", "category": cat, "count": cnt}
            for cat, cnt in sorted(weakness_counts.items(), key=lambda x: -x[1])
        ]
        profile.corrections = other + verified

        from app.models.models import now_kst
        profile.updated_at = now_kst()
        db.commit()
    except Exception:
        logger.exception("검증된 약점 축적 실패 (무시)")


router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisJobOut)
def create_analysis(body: AnalysisJobCreate, db: Session = Depends(get_db)):
    video = video_repo.get_video(db, body.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다.")

    job = analysis_repo.create_job(db, video_id=video.id, device_id=body.device_id)
    analysis_repo.update_job_status(db, job, JobStatus.processing)

    try:
        # 이전 분석 이력 + 짐 프로파일 컨텍스트 생성
        history_context = _build_history_context(db, body.device_id, current_job_id=job.id)
        gym_context = gym_repo.build_context(db, body.device_id) if body.device_id else ""
        full_memo = (history_context + gym_context).strip() or None

        # 짐 프로파일 분석 카운트 증가
        if body.device_id:
            gym_repo.increment_analysis(db, body.device_id)

        analyzer = get_analyzer()
        result_data = analyzer.analyze(
            duration_seconds=video.duration_seconds,
            video_path=video.file_path,
            skill_level=body.skill_level or "beginner",
            attempt_result=body.attempt_result or "failure",
            memo=full_memo,
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

        # 분석 결과에서 자동으로 사용자 프로파일 축적 (피드백 없이도 쌓임)
        if body.device_id:
            _auto_accumulate_profile(db, body.device_id, result_data)
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

    # 짐 프로파일에 피드백 보정사항 축적
    if job.device_id:
        _extract_and_save_corrections(db, job.device_id, body.feedback_text)

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

    # 피드백 후 재분석 = 사용자가 검증한 결과 → 약점 축적 가능
    if job.device_id:
        _accumulate_verified_weakness(db, job.device_id, new_result_data)

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
