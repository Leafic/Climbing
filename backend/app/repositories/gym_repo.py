from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.models import GymProfile, now_kst


def get_or_create(db: Session, device_id: str) -> GymProfile:
    """해당 디바이스의 짐 프로파일 조회, 없으면 생성"""
    profile = db.query(GymProfile).filter(GymProfile.device_id == device_id).first()
    if not profile:
        profile = GymProfile(device_id=device_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def get_profile(db: Session, device_id: str) -> Optional[GymProfile]:
    return db.query(GymProfile).filter(GymProfile.device_id == device_id).first()


def increment_analysis(db: Session, device_id: str) -> GymProfile:
    """분석 수행 시 카운트 증가"""
    profile = get_or_create(db, device_id)
    profile.analysis_count = (profile.analysis_count or 0) + 1
    profile.updated_at = now_kst()
    db.commit()
    db.refresh(profile)
    return profile


def add_correction(db: Session, device_id: str, correction: dict) -> GymProfile:
    """피드백에서 추출한 보정사항 추가 (최대 20개 유지)"""
    profile = get_or_create(db, device_id)
    corrections = list(profile.corrections or [])
    corrections.append(correction)
    # 최근 20개만 유지
    if len(corrections) > 20:
        corrections = corrections[-20:]
    profile.corrections = corrections
    profile.feedback_count = (profile.feedback_count or 0) + 1
    profile.updated_at = now_kst()
    db.commit()
    db.refresh(profile)
    return profile


def update_route_system(db: Session, device_id: str, route_system: str) -> GymProfile:
    """짐의 루트 구분 방식 업데이트"""
    profile = get_or_create(db, device_id)
    profile.route_system = route_system
    profile.updated_at = now_kst()
    db.commit()
    db.refresh(profile)
    return profile


def build_context(db: Session, device_id: str) -> str:
    """짐 프로파일을 프롬프트용 텍스트로 변환"""
    if not device_id:
        return ""
    profile = get_profile(db, device_id)
    if not profile or (not profile.corrections and not profile.route_system):
        return ""

    lines = []
    lines.append("\n[이 사용자의 짐 프로파일 — 이전 분석에서 축적된 정보]")

    if profile.route_system:
        system_names = {
            "sticker": "숫자 스티커 시스템",
            "color": "같은 색상 홀드 시스템",
            "tape": "테이프 시스템",
        }
        lines.append(f"- 이 짐의 루트 구분 방식: {system_names.get(profile.route_system, profile.route_system)}")

    if profile.lighting_note:
        lines.append(f"- 조명 특성: {profile.lighting_note}")

    corrections = profile.corrections or []
    if corrections:
        lines.append(f"- 이전 분석에서 사용자가 지적한 보정사항 ({len(corrections)}건):")
        # 최근 5개만 프롬프트에 포함
        for c in corrections[-5:]:
            ctype = c.get("type", "기타")
            note = c.get("note", "")
            lines.append(f"  * [{ctype}] {note}")
        lines.append("위 보정사항을 이번 분석에 반영하여 같은 실수를 반복하지 마세요.")

    lines.append(f"- 총 분석 {profile.analysis_count}회, 피드백 {profile.feedback_count}회 축적됨\n")
    return "\n".join(lines)
