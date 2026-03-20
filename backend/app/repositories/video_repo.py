from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Video


def create_video(db: Session, filename: str, file_path: str, duration_seconds: float, user_id: str = None, device_id: str = None) -> Video:
    video = Video(
        filename=filename,
        file_path=file_path,
        duration_seconds=duration_seconds,
        user_id=user_id,
        device_id=device_id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def get_video(db: Session, video_id: str) -> Optional[Video]:
    return db.query(Video).filter(Video.id == video_id).first()
