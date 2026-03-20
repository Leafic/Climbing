import os
import subprocess
import logging
from typing import List, Tuple

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


def extract_frames_batch(
    video_path: str,
    timestamps: List[float],
    output_dir: str,
    prefix: str,
) -> List[Tuple[float, str]]:
    """여러 타임스탬프의 프레임을 한번에 추출. [(timeSec, output_path), ...] 반환."""
    os.makedirs(output_dir, exist_ok=True)
    results: List[Tuple[float, str]] = []
    for ts in timestamps:
        fname = f"{prefix}_{int(ts)}s.jpg"
        out_path = os.path.join(output_dir, fname)
        if extract_frame(video_path, ts, out_path):
            results.append((ts, out_path))
    return results


def extract_gif(
    video_path: str,
    start_sec: float,
    end_sec: float,
    output_path: str,
    fps: int = 8,
    width: int = 480,
) -> bool:
    """실패 구간을 GIF로 추출. 최대 5초로 제한."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    duration = min(end_sec - start_sec, 5.0)
    if duration <= 0:
        return False
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-ss", str(start_sec),
                "-t", str(duration),
                "-i", video_path,
                "-vf", f"fps={fps},scale={width}:-1:flags=lanczos",
                "-loop", "0",
                output_path, "-y",
            ],
            capture_output=True,
            timeout=60,
        )
        if result.returncode == 0 and os.path.exists(output_path):
            logger.info("[ffmpeg] GIF 생성 성공: %s (%.1f~%.1fs)", output_path, start_sec, start_sec + duration)
            return True
        logger.warning("[ffmpeg] GIF 생성 실패: returncode=%d, stderr=%s", result.returncode, result.stderr[:200] if result.stderr else "")
        return False
    except Exception as e:
        logger.warning("[ffmpeg] GIF 생성 예외: %s", e)
        return False
