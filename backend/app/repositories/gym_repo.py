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

    # 자동 축적 약점 패턴
    weakness_names = {
        "footwork": "발 위치/풋워크",
        "balance": "무게중심/균형",
        "grip": "그립/손 위치",
        "dynamic": "동적 무브",
        "endurance": "지구력/파워",
        "posture": "자세/몸 방향",
    }
    verified_weaknesses = [c for c in corrections if c.get("type") == "verified_weakness" and c.get("count", 0) >= 2]
    if verified_weaknesses:
        lines.append("- 이 사용자의 반복 약점 (피드백으로 검증됨):")
        for w in verified_weaknesses[:4]:
            cat_name = weakness_names.get(w["category"], w["category"])
            lines.append(f"  * {cat_name}: {w['count']}회 확인됨")
        lines.append("  → 위 약점이 이번 영상에서도 보이면 '여전히 반복되는 문제'로 강조하세요.")
        lines.append("  → 개선되었으면 '개선된 점'으로 명시하세요.")

    # 자동 축적 성공률
    auto_stats = next((c for c in corrections if c.get("type") == "auto_stats"), None)
    if auto_stats:
        lines.append(f"- 누적 성적: 총 {auto_stats['total']}회 시도, 성공률 {auto_stats['success_rate']}%, 평균 완성도 {auto_stats['avg_prob']}%")

    # 수동 피드백 보정사항
    manual = [c for c in corrections if c.get("type") not in ("auto_weakness", "auto_stats")]
    if manual:
        lines.append(f"- 사용자가 직접 지적한 보정사항 ({len(manual)}건):")
        for c in manual[-3:]:
            ctype = c.get("type", "기타")
            note = c.get("note", "")
            lines.append(f"  * [{ctype}] {note}")
        lines.append("  → 위 보정사항을 이번 분석에 반영하여 같은 실수를 반복하지 마세요.")

    lines.append("")
    return "\n".join(lines)
