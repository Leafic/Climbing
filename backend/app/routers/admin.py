from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models.models import AnalysisJob, Video, JobStatus

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    """모든 디바이스별 사용 통계"""
    rows = (
        db.query(
            AnalysisJob.device_id,
            func.count(AnalysisJob.id).label("total"),
            func.min(AnalysisJob.created_at).label("first_seen"),
            func.max(AnalysisJob.created_at).label("last_seen"),
        )
        .filter(AnalysisJob.device_id.isnot(None))
        .group_by(AnalysisJob.device_id)
        .order_by(func.max(AnalysisJob.created_at).desc())
        .all()
    )

    devices = []
    for row in rows:
        completed = (
            db.query(func.count(AnalysisJob.id))
            .filter(AnalysisJob.device_id == row.device_id, AnalysisJob.status == JobStatus.completed)
            .scalar()
        )
        video_count = (
            db.query(func.count(Video.id))
            .filter(Video.device_id == row.device_id)
            .scalar()
        )
        devices.append({
            "device_id": row.device_id,
            "total_analyses": row.total,
            "completed_analyses": completed,
            "videos_uploaded": video_count,
            "first_seen": row.first_seen.isoformat() if row.first_seen else None,
            "last_seen": row.last_seen.isoformat() if row.last_seen else None,
        })

    # 전체 요약
    total_devices = len(devices)
    total_analyses = sum(d["total_analyses"] for d in devices)
    unknown_analyses = (
        db.query(func.count(AnalysisJob.id))
        .filter(AnalysisJob.device_id.is_(None))
        .scalar()
    )

    return {
        "summary": {
            "total_devices": total_devices,
            "total_analyses": total_analyses + unknown_analyses,
            "identified_analyses": total_analyses,
            "anonymous_analyses": unknown_analyses,
        },
        "devices": devices,
    }


@router.get("/devices/{device_id}")
def get_device_detail(device_id: str, db: Session = Depends(get_db)):
    """특정 디바이스의 상세 분석 이력"""
    from app.repositories import analysis_repo

    stats = analysis_repo.get_device_stats(db, device_id)
    history = analysis_repo.get_device_history(db, device_id, limit=20)

    analyses = []
    for r in history:
        rj = r.result_json if isinstance(r.result_json, dict) else {}
        analyses.append({
            "job_id": r.analysis_job_id,
            "revision": r.revision,
            "attempt_result": rj.get("attemptResult"),
            "skill_level": rj.get("skillLevel"),
            "completion_probability": rj.get("completionProbability"),
            "summary": rj.get("summary", "")[:100],
            "fail_reason": rj.get("failReason"),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 반복 패턴 추출
    issue_counts: dict[str, int] = {}
    for r in history:
        rj = r.result_json if isinstance(r.result_json, dict) else {}
        for obs in (rj.get("keyObservations") or []):
            if isinstance(obs, dict) and obs.get("type") == "issue":
                text = obs.get("observation", "")[:40]
                if text:
                    issue_counts[text] = issue_counts.get(text, 0) + 1

    top_issues = sorted(issue_counts.items(), key=lambda x: -x[1])[:5]

    return {
        **stats,
        "analyses": analyses,
        "recurring_issues": [{"issue": k, "count": v} for k, v in top_issues],
    }
