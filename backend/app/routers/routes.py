import os
import uuid
import logging
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from app.services.analyzer import get_analyzer
from app.utils.route_drawer import draw_routes_on_image

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

    ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    ext = os.path.splitext(file.filename or "img.jpg")[1].lower() or ".jpg"
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")

    if len(hold_color) > 50:
        raise HTTPException(status_code=400, detail="홀드 색상은 50자 이내로 입력해주세요.")

    # 임시 저장 (크기 제한 20MB)
    MAX_IMAGE_SIZE = 20 * 1024 * 1024
    temp_name = f"route_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_DIR, temp_name)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    try:
        size = 0
        with open(temp_path, "wb") as f:
            while chunk := file.file.read(8192):
                size += len(chunk)
                if size > MAX_IMAGE_SIZE:
                    f.close()
                    os.remove(temp_path)
                    raise HTTPException(status_code=400, detail="이미지 크기가 20MB를 초과합니다.")
                f.write(chunk)

        analyzer = get_analyzer()
        result = analyzer.analyze_route(
            image_path=temp_path,
            hold_color=hold_color,
            skill_level=skill_level,
        )

        # 루트 경로를 이미지에 그리기
        routes = result.get("routes", [])
        if routes:
            route_image_url = draw_routes_on_image(temp_path, routes)
            result["routeImageUrl"] = route_image_url

        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("루트 분석 실패")
        raise HTTPException(status_code=500, detail="루트 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
