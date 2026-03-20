import os
import uuid
import logging
from typing import List, Dict

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# 루트별 색상 (최대 5개)
ROUTE_COLORS = [
    (255, 60, 60),     # 빨강
    (60, 180, 255),    # 파랑
    (60, 220, 80),     # 초록
    (255, 200, 40),    # 노랑
    (200, 100, 255),   # 보라
]


def draw_routes_on_image(image_path: str, routes: List[Dict]) -> str:
    """이미지 위에 루트 경로를 그려서 새 파일로 저장, 경로 반환"""
    try:
        img = Image.open(image_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        w, h = img.size

        for route_idx, route in enumerate(routes):
            holds = route.get("holds", [])
            if not holds:
                continue

            color = ROUTE_COLORS[route_idx % len(ROUTE_COLORS)]
            line_color = color + (180,)  # 반투명
            circle_color = color + (220,)
            text_color = (255, 255, 255, 255)

            # 좌표 변환 (% → px)
            points = []
            for hold in holds:
                x = int(hold.get("xPct", 0) / 100 * w)
                y = int(hold.get("yPct", 0) / 100 * h)
                points.append((x, y))

            # 경로 선 그리기 (두꺼운 선)
            if len(points) >= 2:
                line_width = max(3, int(min(w, h) * 0.006))
                for i in range(len(points) - 1):
                    draw.line([points[i], points[i + 1]], fill=line_color, width=line_width)

                    # 화살표 방향 표시 (중간 지점에 작은 원)
                    mx = (points[i][0] + points[i + 1][0]) // 2
                    my = (points[i][1] + points[i + 1][1]) // 2
                    arrow_r = max(2, line_width)
                    draw.ellipse(
                        [mx - arrow_r, my - arrow_r, mx + arrow_r, my + arrow_r],
                        fill=line_color,
                    )

            # 홀드 번호 원 그리기
            radius = max(12, int(min(w, h) * 0.025))
            for i, (px, py) in enumerate(points):
                # 원 배경
                draw.ellipse(
                    [px - radius, py - radius, px + radius, py + radius],
                    fill=circle_color,
                    outline=(255, 255, 255, 200),
                    width=2,
                )
                # 라벨 텍스트
                label = holds[i].get("label", str(i + 1))
                # 짧게 표시
                if len(label) > 2:
                    label = label[:2]

                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(10, radius))
                except (IOError, OSError):
                    font = ImageFont.load_default()

                bbox = draw.textbbox((0, 0), label, font=font)
                tw = bbox[2] - bbox[0]
                th = bbox[3] - bbox[1]
                draw.text(
                    (px - tw // 2, py - th // 2),
                    label,
                    fill=text_color,
                    font=font,
                )

        # 합성
        result = Image.alpha_composite(img, overlay).convert("RGB")

        # 저장
        os.makedirs(os.path.join(UPLOAD_DIR, "routes"), exist_ok=True)
        out_name = f"routes/route_{uuid.uuid4().hex[:8]}.jpg"
        out_path = os.path.join(UPLOAD_DIR, out_name)
        result.save(out_path, "JPEG", quality=90)

        logger.info("[RouteDrawer] 루트 이미지 생성: %s", out_path)
        return f"/uploads/{out_name}"

    except Exception as e:
        logger.exception("루트 이미지 생성 실패")
        return ""
