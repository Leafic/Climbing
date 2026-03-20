from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
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
    import os

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 파일 형식입니다. 허용: {ALLOWED_EXTENSIONS}")

    if duration_seconds <= 0:
        raise HTTPException(status_code=400, detail="영상 길이는 0보다 커야 합니다.")

    try:
        file_path = save_upload_file(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    video = video_repo.create_video(
        db=db,
        filename=file.filename,
        file_path=file_path,
        duration_seconds=duration_seconds,
        device_id=device_id,
    )
    return video
