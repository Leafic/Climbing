import os
import shutil
from fastapi import UploadFile

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_upload_file(upload_file: UploadFile) -> str:
    ensure_upload_dir()
    dest_path = os.path.join(UPLOAD_DIR, upload_file.filename)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(upload_file.file, f)
    return dest_path
