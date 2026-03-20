import os

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.models import AnalysisJob, JobStatus
from app.repositories import video_repo
from app.schemas.video import VideoUploadResponse
from app.utils.file_utils import save_upload_file

router = APIRouter(prefix="/api/videos", tags=["videos"])

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm"}


@router.post("/upload", response_model=VideoUploadResponse)
def upload_video(
    file: UploadFile = File(...),
    duration_seconds: float = Form(...),
    device_id: str = Form(None),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 파일 형식입니다. 허용: {ALLOWED_EXTENSIONS}")

    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="영상 길이는 0보다 커야 합니다.")

    try:
        file_path, file_hash = save_upload_file(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 같은 영상 중복 업로드 감지
    existing = video_repo.find_by_hash(db, file_hash, device_id)
    if existing:
        os.remove(file_path)
        # 가장 최근 완료된 분석 job 찾기
        latest_job = (
            db.query(AnalysisJob)
            .filter(AnalysisJob.video_id == existing.id, AnalysisJob.status == JobStatus.completed)
            .order_by(AnalysisJob.updated_at.desc())
            .first()
        )
        return VideoUploadResponse(
            id=existing.id,
            filename=existing.filename,
            duration_seconds=existing.duration_seconds,
            created_at=existing.created_at,
            is_duplicate=True,
            existing_analysis_id=latest_job.id if latest_job else None,
        )

    video = video_repo.create_video(
        db=db,
        filename=file.filename,
        file_path=file_path,
        duration_seconds=duration_seconds,
        device_id=device_id,
        file_hash=file_hash,
    )
    return video
