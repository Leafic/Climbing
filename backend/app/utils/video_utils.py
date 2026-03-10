import os
import subprocess
import logging

logger = logging.getLogger(__name__)


def extract_frame(video_path: str, timestamp_sec: float, output_path: str) -> bool:
    """ffmpeg으로 특정 타임스탬프의 프레임을 JPEG로 추출. 성공 시 True 반환."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-ss", str(timestamp_sec),
                "-i", video_path,
                "-frames:v", "1",
                "-q:v", "3",
                output_path, "-y",
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0 and os.path.exists(output_path):
            logger.info("[ffmpeg] 프레임 추출 성공: %s (%.1fs)", output_path, timestamp_sec)
            return True
        logger.warning("[ffmpeg] 프레임 추출 실패: returncode=%d", result.returncode)
        return False
    except Exception as e:
        logger.warning("[ffmpeg] 프레임 추출 예외: %s", e)
        return False
