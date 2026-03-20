# ClimbAI - 클라이밍 AI 분석 서비스

## 프로젝트 방향성
- **웹 + 앱 모두 지원** — PWA 기반으로 웹/앱 동시 제공, 실제 앱 배포가 최종 목표
- **모바일 퍼스트** — iPhone, Android에서의 사용이 주 사용 환경. 모든 UI는 모바일 우선 설계
- **실제 서비스 배포 목적** — 개발용이 아닌 실사용자 대상 서비스

## 기술 스택
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS (PWA)
- **AI**: Google Gemini API (Flash 모델만 사용)
- **인프라**: Docker Compose

## 핵심 규칙
- **Gemini Pro 모델 절대 금지** — 과금됨. Flash 모델만 사용 (`gemini-2.5-flash`, `gemini-3.1-flash-lite-preview`)
- **검증되지 않은 AI 판단 자동 축적 금지** — 피드백으로 검증된 데이터만 개인화에 반영
- **모바일 UX 최우선** — 터치 타겟, 폰트 크기, safe-area 등 모바일 기준 설계

## 구조
```
backend/        # FastAPI 서버
  app/
    routers/    # API 엔드포인트
    services/   # Gemini 분석 서비스
    repositories/ # DB 접근 계층
    models/     # SQLAlchemy 모델
    schemas/    # Pydantic 스키마
frontend/       # Next.js 15 앱
  app/          # App Router 페이지
  components/   # 공유 컴포넌트
  lib/          # API 클라이언트, 유틸
```

## DB 참고
- Alembic 미사용 — 스키마 변경 시 수동 SQL 필요
- 연결: `climbing_user` / `climbing_db` (포트 5433)
