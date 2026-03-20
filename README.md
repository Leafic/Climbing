# ClimbAI - 클라이밍 AI 분석 서비스

클라이밍 영상을 업로드하면 AI가 실패 원인, 자세, 발 위치, 무게중심을 분석하고 완등 전략을 제안합니다.
사용자 피드백을 반영한 **재분석 루프**와 **검증 기반 개인화**가 핵심 기능입니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| **영상 AI 분석** | 클라이밍 영상 업로드 → 자세/발/무게중심/실패원인 분석 |
| **피드백 재분석** | AI 분석 결과에 피드백 → 수정된 재분석 (무한 반복 가능) |
| **개인화** | 디바이스별 약점/성공률 축적 → 맞춤형 분석 제공 |
| **루트 찾기** | 벽 사진 + 홀드 색상 → AI가 루트 경로 제안 |
| **동일 영상 감지** | SHA256 해시로 같은 영상 재업로드 방지 |
| **PWA** | 홈화면 설치, 오프라인 캐시, 공유 타겟 지원 |

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | FastAPI 0.115 + SQLAlchemy 2.0 + PostgreSQL 16 |
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS |
| AI | Google Gemini API (Flash 모델) |
| 미디어 | ffmpeg (프레임/GIF 추출) |
| 인프라 | Docker Compose |

---

## 빠른 시작 (Docker)

### 사전 요구사항
- Docker Desktop 설치 ([brew install --cask docker](https://docs.docker.com/desktop/install/mac-install/))
- Google Gemini API 키 ([발급 링크](https://aistudio.google.com/apikey))

### 실행

```bash
# 1. 클론
git clone <레포지토리 URL> Climbing && cd Climbing

# 2. 환경 변수 설정
echo "GOOGLE_API_KEY=AIza...your_key_here" > .env

# 3. 빌드 & 실행
docker compose up -d --build
```

### 접속

| 서비스 | 주소 |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5433 |

---

## 자주 쓰는 명령어

```bash
# 시작/종료
docker compose up -d              # 시작
docker compose down               # 종료 (데이터 유지)
docker compose down -v            # 종료 + DB 데이터 삭제

# 코드 수정 반영
docker compose restart backend                           # 백엔드 (볼륨 마운트)
docker compose build --no-cache frontend && docker compose up -d frontend  # 프론트엔드 (재빌드 필수)

# 로그
docker compose logs -f backend
docker compose logs -f frontend

# DB 접속
docker compose exec db psql -U climbing_user -d climbing_db
```

---

## 로컬 직접 실행 (Docker 미사용)

### 백엔드

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # GOOGLE_API_KEY 설정
uvicorn app.main:app --reload
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

---

## 프로젝트 구조

```
Climbing/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI 앱 진입점
│       ├── db.py                # DB 연결 설정
│       ├── models/models.py     # ORM 모델 (User, Video, AnalysisJob, etc.)
│       ├── routers/             # API 라우터 (videos, analysis, routes, admin)
│       ├── services/analyzer.py # Gemini AI 분석 엔진
│       ├── repositories/        # DB CRUD 레이어
│       └── utils/               # 파일, 영상, 루트 드로잉 유틸
├── frontend/
│   ├── app/                     # Next.js App Router 페이지
│   ├── components/              # 공유 컴포넌트
│   ├── lib/                     # API 클라이언트, 디바이스 ID 관리
│   └── public/                  # PWA 매니페스트, 서비스워커, 아이콘
├── docker-compose.yml
├── CLAUDE.md                    # 프로젝트 상세 컨텍스트 (AI 어시스턴트용)
└── README.md                    # 이 파일
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/videos/upload` | 영상 업로드 (100MB, SHA256 중복 감지) |
| `POST` | `/api/analysis` | 분석 요청 |
| `GET` | `/api/analysis/{id}` | 분석 결과 조회 |
| `POST` | `/api/analysis/{id}/feedback` | 피드백 → 재분석 |
| `GET` | `/api/analysis/{id}/history` | 분석 이력 |
| `GET` | `/api/analysis/device/{device_id}/list` | 디바이스별 분석 목록 |
| `POST` | `/api/routes/analyze` | 루트 찾기 (이미지 + 색상) |
| `GET` | `/api/admin/devices` | 디바이스 통계 |

## 사용자 플로우

```
홈 → 영상 업로드 → 숙련도/결과 선택 → AI 분석
  → 결과 확인 (요약, 타임라인, 코칭)
    → 피드백 입력 → 재분석 (반복)
      → 내 분석 이력 확인
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | DB 연결 문자열 |
| `GOOGLE_API_KEY` | (없음) | Gemini API 키 (없으면 MockAnalyzer) |
| `UPLOAD_DIR` | `./uploads` | 영상 저장 경로 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 허용 도메인 |

## 라이선스

Private — All rights reserved.
