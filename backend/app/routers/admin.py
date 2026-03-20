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

    # 반복 패턴 추출 — 키워드 기반 유사 이슈 그룹핑
    issue_categories = {
        "발 위치/풋워크": ["발 위치", "풋워크", "발이 미끄", "발바닥", "발끝", "토", "힐훅", "스미어링", "디딤", "밟"],
        "무게중심/균형": ["무게중심", "중심", "균형", "골반", "벽에서 멀", "벽에서 떨", "몸이 뒤"],
        "그립/손 위치": ["그립", "손 위치", "손이 미끄", "잡지 못", "홀드를 잡", "손목"],
        "체중 이동": ["체중 이동", "체중", "이동", "트랜지션"],
        "동적 무브": ["다이나믹", "도약", "랜지", "데드포인트", "점프"],
        "지구력/파워": ["지구력", "파워", "힘이 빠", "펌핑", "전완"],
        "자세/몸 방향": ["자세", "몸 방향", "회전", "턴", "플래깅", "드롭니"],
        "루트 리딩": ["루트 리딩", "루트 파악", "경로", "순서"],
    }

    all_issues: list[str] = []
    for r in history:
        rj = r.result_json if isinstance(r.result_json, dict) else {}
        for obs in (rj.get("keyObservations") or []):
            if isinstance(obs, dict) and obs.get("type") == "issue":
                text = obs.get("observation", "")
                if text:
                    all_issues.append(text)

    # 카테고리별 매칭
    category_data: dict[str, dict] = {}
    for issue_text in all_issues:
        matched = False
        for cat_name, keywords in issue_categories.items():
            if any(kw in issue_text for kw in keywords):
                if cat_name not in category_data:
                    category_data[cat_name] = {"count": 0, "examples": []}
                category_data[cat_name]["count"] += 1
                if len(category_data[cat_name]["examples"]) < 2:
                    category_data[cat_name]["examples"].append(issue_text)
                matched = True
                break
        if not matched:
            cat_name = "기타"
            if cat_name not in category_data:
                category_data[cat_name] = {"count": 0, "examples": []}
            category_data[cat_name]["count"] += 1
            if len(category_data[cat_name]["examples"]) < 2:
                category_data[cat_name]["examples"].append(issue_text)

    # 가장 많이 반복되는 카테고리 순으로 정렬
    top_issues = sorted(category_data.items(), key=lambda x: -x[1]["count"])[:5]

    return {
        **stats,
        "analyses": analyses,
        "recurring_issues": [
            {
                "category": cat,
                "count": data["count"],
                "examples": data["examples"],
            }
            for cat, data in top_issues
        ],
    }
