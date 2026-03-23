import os
import uuid
import logging
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import gym_repo
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
    start_hint: str = Form(""),
    device_id: str = Form(""),
    db: Session = Depends(get_db),
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

        # 짐 프로파일에서 컨텍스트 가져오기
        gym_context = ""
        if device_id:
            gym_context = gym_repo.build_context(db, device_id)
            gym_repo.increment_analysis(db, device_id)

        # start_hint에 짐 프로파일 컨텍스트 병합
        combined_hint = start_hint.strip()
        if gym_context:
            combined_hint = (combined_hint + "\n" + gym_context).strip() if combined_hint else gym_context.strip()

        analyzer = get_analyzer()
        result = analyzer.analyze_route(
            image_path=temp_path,
            hold_color=hold_color,
            skill_level=skill_level,
            start_hint=combined_hint,
        )

        # 루트 시스템 정보 자동 축적
        if device_id and result.get("routeSystem"):
            gym_repo.update_route_system(db, device_id, result["routeSystem"])

        # 원본 이미지를 별도 저장 (프론트엔드 오버레이용)
        import shutil, uuid as _uuid
        upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
        os.makedirs(os.path.join(upload_dir, "originals"), exist_ok=True)
        ext = os.path.splitext(temp_path)[1] or ".jpg"
        orig_name = f"originals/orig_{_uuid.uuid4().hex[:8]}{ext}"
        orig_path = os.path.join(upload_dir, orig_name)
        shutil.copy2(temp_path, orig_path)
        result["originalImageUrl"] = f"/uploads/{orig_name}"

        # 원본 이미지 크기 저장
        from PIL import Image as _PILImage
        try:
            with _PILImage.open(temp_path) as _img:
                result["imageWidth"] = _img.width
                result["imageHeight"] = _img.height
        except Exception:
            pass

        # 루트 경로를 이미지에 그리기 (참고용)
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
