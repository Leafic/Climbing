import os
import uuid
import logging
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.services.analyzer import get_analyzer

logger = logging.getLogger(__name__)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.post("/analyze")
def analyze_route(
    file: UploadFile = File(...),
    hold_color: str = Form(...),
    skill_level: str = Form("beginner"),
):
    # 이미지 파일 검증
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    # 임시 저장
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    temp_name = f"route_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_DIR, temp_name)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    try:
        with open(temp_path, "wb") as f:
            f.write(file.file.read())

        analyzer = get_analyzer()
        result = analyzer.analyze_route(
            image_path=temp_path,
            hold_color=hold_color,
            skill_level=skill_level,
        )
        return result
    except Exception as e:
        logger.exception("루트 분석 실패")
        raise HTTPException(status_code=500, detail=f"루트 분석 중 오류: {str(e)}")
    finally:
        # 임시 파일 삭제
        if os.path.exists(temp_path):
            os.remove(temp_path)
