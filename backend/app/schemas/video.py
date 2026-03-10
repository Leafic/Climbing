from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VideoUploadResponse(BaseModel):
    id: str
    filename: str
    duration_seconds: float
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoOut(BaseModel):
    id: str
    filename: str
    file_path: str
    duration_seconds: float
    created_at: datetime

    model_config = {"from_attributes": True}
