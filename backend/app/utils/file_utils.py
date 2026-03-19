import os
import re
import uuid
import shutil
from fastapi import UploadFile

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _sanitize_filename(filename: str) -> str:
    """경로 탐색 공격 방지: 파일명에서 위험 문자 제거 + UUID 접두사"""
    # 디렉토리 구분자 제거
    name = os.path.basename(filename)
    # 허용 문자만 남기기 (한글, 영문, 숫자, 점, 하이픈, 언더스코어)
    name = re.sub(r'[^\w가-힣.\-]', '_', name)
    # UUID 접두사로 충돌 방지
    return f"{uuid.uuid4().hex[:8]}_{name}"


def save_upload_file(upload_file: UploadFile) -> str:
    ensure_upload_dir()
    safe_name = _sanitize_filename(upload_file.filename or "unnamed")
    dest_path = os.path.join(UPLOAD_DIR, safe_name)

    # 경로가 UPLOAD_DIR 내부인지 검증
    real_dest = os.path.realpath(dest_path)
    real_upload = os.path.realpath(UPLOAD_DIR)
    if not real_dest.startswith(real_upload):
        raise ValueError("잘못된 파일 경로입니다.")

    # 크기 제한 체크하며 저장
    size = 0
    with open(dest_path, "wb") as f:
        while chunk := upload_file.file.read(8192):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                os.remove(dest_path)
                raise ValueError(f"파일 크기가 {MAX_FILE_SIZE // (1024*1024)}MB를 초과합니다.")
            f.write(chunk)

    return dest_path
