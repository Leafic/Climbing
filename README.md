# ClimbAI — 클라이밍 영상 분석 AI MVP

클라이밍 영상을 업로드하면 AI가 실패 원인, 자세, 발 위치, 무게중심을 분석하고 완등 전략을 제안합니다.
사용자 피드백을 반영한 **재분석 루프**가 핵심 기능입니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | FastAPI + SQLAlchemy + SQLite(dev) / PostgreSQL(prod) |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| AI | MockAnalyzer (MVP) → BaseAnalyzer 인터페이스로 교체 가능 |
| Storage | 로컬 파일시스템 (`backend/uploads/`) → S3 교체 가능 |

## 프로젝트 구조

```
Climbing/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py              # FastAPI 앱 진입점
│       ├── db.py                # DB 연결 설정
│       ├── models/models.py     # ORM 모델
│       ├── schemas/             # Pydantic 요청/응답 스키마
│       ├── routers/             # API 라우터
│       │   ├── videos.py        # POST /api/videos/upload
│       │   └── analysis.py      # /api/analysis 전체
│       ├── services/
│       │   └── analyzer.py      # ⭐ AI 분석 인터페이스 (교체 포인트)
│       ├── repositories/        # DB CRUD 레이어
│       └── utils/file_utils.py  # 파일 저장 유틸
└── frontend/
    ├── app/
    │   ├── page.tsx             # 랜딩 페이지
    │   ├── upload/page.tsx      # 업로드 + 분석 요청
    │   └── analysis/[id]/page.tsx  # 결과 + 피드백 + 이력
    ├── components/
    │   └── AnalysisResultCard.tsx
    └── lib/api.ts               # fetch 기반 API 클라이언트
```

## Docker로 실행 (권장)

### Step 0 — Docker Desktop 설치 (최초 1회)

```bash
# Homebrew로 설치 (권장)
brew install --cask docker

# 설치 후 Docker Desktop 앱 실행 (처음 한 번은 GUI로 열어야 데몬이 시작됨)
open /Applications/Docker.app

# 데몬 준비 완료 확인 (초록불 뜰 때까지 대기 후 실행)
docker info
```

> Homebrew가 없으면 먼저 설치: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

---

### Step 1 — 프로젝트 클론 (최초 1회)

```bash
git clone <레포지토리 URL> Climbing
cd Climbing
```

---

### Step 2 — 전체 빌드 및 실행 (최초 1회)

```bash
# 프로젝트 루트(docker-compose.yml 위치)에서 실행
cd /path/to/Climbing

# 이미지 빌드 + 컨테이너 생성 + 백그라운드 실행
docker compose up -d --build
```

빌드 첫 실행은 이미지 다운로드 + 설치로 3~5분 소요됩니다.

> **참고 (이미 Docker Desktop 설치된 경우):** Step 0 건너뛰고 Step 1부터 시작하면 됩니다.

---

### Step 3 — 상태 확인

```bash
# 컨테이너 3개 모두 running 상태인지 확인
docker compose ps

# 전체 로그 실시간 확인
docker compose logs -f

# 서비스별 로그
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

| 서비스 | 접속 주소 |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

---

### 일상적인 사용 명령어

```bash
# 전체 시작 (이미 빌드된 경우)
docker compose up -d

# 전체 종료 (데이터 유지)
docker compose down

# 특정 서비스만 재시작
docker compose restart backend
docker compose restart frontend

# 컨테이너 상태 확인
docker compose ps
```

---

### 코드 수정 후 반영

```bash
# 백엔드 코드 수정 시 — app/ 폴더는 볼륨 마운트라 재빌드 불필요, 재시작만
docker compose restart backend

# 백엔드 requirements.txt 또는 Dockerfile 수정 시
docker compose up -d --build backend

# 프론트엔드 코드 수정 시
docker compose up -d --build frontend

# 전체 재빌드
docker compose up -d --build
```

---

### 개별 컨테이너 접속

```bash
# 백엔드 쉘 접속
docker compose exec backend sh

# DB psql 직접 접속
docker compose exec db psql -U climbing_user -d climbing_db

# DB 테이블 목록 확인
docker compose exec db psql -U climbing_user -d climbing_db -c "\dt"
```

---

### 초기화 / 문제 해결

```bash
# 컨테이너만 삭제 (이미지·데이터 유지)
docker compose down

# DB 데이터까지 삭제하고 완전 초기화
docker compose down -v
docker compose up -d --build

# 사용하지 않는 이미지·캐시 전체 정리 (디스크 절약)
docker system prune -f

# 특정 컨테이너 로그 마지막 100줄
docker compose logs --tail=100 backend
```

### 자주 쓰는 명령어

```bash
# 특정 서비스만 재시작
docker compose restart backend
docker compose restart frontend

# 특정 서비스 로그만 보기
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# 컨테이너 상태 확인
docker compose ps

# 코드 변경 후 이미지 재빌드
docker compose up -d --build backend
docker compose up -d --build frontend

# DB 데이터 포함 전체 초기화 (주의: 데이터 삭제됨)
docker compose down -v
docker compose up -d --build
```

### 개별 컨테이너 접속

```bash
# 백엔드 쉘 접속
docker compose exec backend sh

# DB psql 접속
docker compose exec db psql -U climbing_user -d climbing_db
```

### 접속 주소

| 서비스 | 주소 |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

---

## 새 컨테이너 추가하는 법

`docker-compose.yml`에 서비스 블록을 추가하는 것이 전부입니다.
아래 패턴을 복사해서 상황에 맞게 수정하세요.

### 패턴 1 — 외부 이미지 사용 (Redis, MySQL 등)

```yaml
# docker-compose.yml의 services: 아래에 추가
services:
  redis:
    image: redis:7-alpine          # Docker Hub 이미지
    container_name: climbing_redis
    ports:
      - "6379:6379"                # 호스트포트:컨테이너포트
    volumes:
      - redis_data:/data           # 데이터 영속 저장

volumes:
  redis_data:                      # 위 volumes 블록에도 추가
```

### 패턴 2 — 직접 빌드한 이미지 사용 (Celery Worker 등)

```yaml
services:
  worker:
    build: ./backend               # Dockerfile 위치
    container_name: climbing_worker
    command: celery -A app.celery_app worker --loglevel=info   # 실행 명령 오버라이드
    environment:
      DATABASE_URL: postgresql://climbing_user:climbing_pass@db:5432/climbing_db
      REDIS_URL: redis://redis:6379/0
    volumes:
      - ./backend/app:/app/app     # 코드 마운트 (핫리로드용)
    depends_on:
      - db
      - redis                      # 이 서비스가 먼저 떠야 함
```

### 서비스 간 통신 규칙

컨테이너끼리는 `container_name` 또는 서비스명을 호스트로 사용합니다.
`localhost`는 같은 컨테이너 안에서만 유효합니다.

```
# 백엔드 → DB 접속
DATABASE_URL=postgresql://user:pass@db:5432/climbing_db
#                                    ^^
#                              서비스명을 호스트로 사용

# 백엔드 → Redis 접속
REDIS_URL=redis://redis:6379/0
#                 ^^^^^
#            서비스명을 호스트로 사용
```

### depends_on 옵션

```yaml
depends_on:
  db:
    condition: service_healthy   # DB healthcheck 통과 후 시작 (권장)
  redis:
    condition: service_started   # 컨테이너 시작만 확인 (기본값)
```

### 새 컨테이너 추가 후 적용 순서

```bash
# 1. docker-compose.yml 수정 후
docker compose up -d --build     # 전체 재시작 + 변경된 이미지 재빌드

# 또는 새 서비스만 추가하는 경우
docker compose up -d redis       # 특정 서비스만 시작

# 2. 추가된 서비스 확인
docker compose ps

# 3. 로그 확인
docker compose logs -f redis
```

### 이 프로젝트에서 앞으로 추가할 수 있는 서비스

| 서비스 | 이미지 | 용도 | docker-compose.yml 내 주석 위치 |
|---|---|---|---|
| Redis | `redis:7-alpine` | 비동기 분석 큐 | 파일 내 주석으로 준비됨 |
| Celery Worker | `./backend` (빌드) | 영상 분석 비동기 처리 | 파일 내 주석으로 준비됨 |
| Nginx | `nginx:alpine` | 리버스 프록시 / HTTPS | 필요 시 추가 |

Redis와 Celery Worker는 `docker-compose.yml` 안에 주석으로 미리 작성되어 있습니다.
주석만 해제하면 바로 사용할 수 있습니다.

---

## 로컬 직접 실행 (Docker 미사용)

### 사전 요구사항
- Python 3.9+
- Node.js 18+

### 백엔드

```bash
cd backend

# 가상환경 생성 및 의존성 설치
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일 수정 (SQLite 기본값으로 바로 실행 가능)

# 서버 실행 (포트 8000)
uvicorn app.main:app --reload
```

- API 문서: http://localhost:8000/docs
- DB는 `backend/climbing.db`로 자동 생성됨 (SQLite 기준)

### 프론트엔드

```bash
cd frontend
npm install
npm run dev   # 포트 3000
```

브라우저에서 http://localhost:3000 접속

## API 목록

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/videos/upload` | 영상 업로드 (multipart) |
| `POST` | `/api/analysis` | 분석 요청 생성 |
| `GET` | `/api/analysis/{id}` | 분석 결과 조회 |
| `POST` | `/api/analysis/{id}/feedback` | 피드백 제출 + 재분석 |
| `GET` | `/api/analysis/{id}/history` | 전체 분석 이력 조회 |

## 사용자 플로우

```
영상 업로드 (/upload)
  → 분석 요청
    → 결과 확인 (/analysis/[id])
      → 피드백 입력 → 재분석 (최대 반복)
        → 이력 조회
```

## 실제 AI 연결 방법

[backend/app/services/analyzer.py](backend/app/services/analyzer.py)의 `get_analyzer()` 함수만 교체하면 됩니다.

```python
# 현재 (Mock)
def get_analyzer() -> BaseAnalyzer:
    return MockAnalyzer()

# Claude API 연결 예시
def get_analyzer() -> BaseAnalyzer:
    return ClaudeAnalyzer(api_key=os.getenv("ANTHROPIC_API_KEY"))
```

`BaseAnalyzer`의 두 메서드만 구현하면 나머지는 변경 없이 동작합니다.

```python
class BaseAnalyzer(ABC):
    def analyze(self, duration_seconds: float, memo: str = None) -> dict: ...
    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict: ...
```

## 분석 결과 JSON 구조

```json
{
  "summary": "왼손 홀드 전환 이후 체중 이동이 늦어 실패했습니다.",
  "failReason": "크럭스 구간 체중 중심 이동 부족",
  "failSegment": { "startSec": 49.5, "endSec": 63.0, "description": "..." },
  "strategySuggestions": ["전략 1", "전략 2"],
  "postureFeedback": ["..."],
  "footworkFeedback": ["..."],
  "centerOfMassFeedback": ["..."],
  "completionProbability": 68,
  "confidence": 0.78,
  "userFeedbackApplied": false,
  "revisedPoints": []
}
```

## PostgreSQL 전환 방법

`.env` 파일의 `DATABASE_URL`만 변경하면 됩니다.

```env
# SQLite (기본, 로컬 개발)
DATABASE_URL=sqlite:///./climbing.db

# PostgreSQL (운영)
DATABASE_URL=postgresql://user:password@localhost:5432/climbing_db
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./climbing.db` | DB 연결 문자열 |
| `UPLOAD_DIR` | `./uploads` | 영상 저장 경로 |
