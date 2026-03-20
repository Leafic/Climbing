from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Video


def create_video(db: Session, filename: str, file_path: str, duration_seconds: float,
                 user_id: str = None, device_id: str = None, file_hash: str = None) -> Video:
    video = Video(
        filename=filename,
        file_path=file_path,
        duration_seconds=duration_seconds,
        user_id=user_id,
        device_id=device_id,
        file_hash=file_hash,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def find_by_hash(db: Session, file_hash: str, device_id: str = None) -> Optional[Video]:
    """같은 해시 + 같은 디바이스의 기존 영상 조회"""
    q = db.query(Video).filter(Video.file_hash == file_hash)
    if device_id:
        q = q.filter(Video.device_id == device_id)
    return q.first()


def get_video(db: Session, video_id: str) -> Optional[Video]:
    return db.query(Video).filter(Video.id == video_id).first()
