# ClimbAI - 클라이밍 AI 분석 서비스

## 프로젝트 개요

클라이밍 영상을 업로드하면 AI(Google Gemini Flash)가 자세, 발 위치, 무게중심, 실패 원인을 분석하고,
사용자 피드백을 반영한 **재분석 루프**와 **검증 기반 개인화**를 제공하는 서비스.

## 프로젝트 방향성

- **웹 + 앱 모두 지원** — PWA 기반으로 웹/앱 동시 제공, 실제 앱스토어 배포가 최종 목표
- **모바일 퍼스트** — iPhone, Android에서의 사용이 주 사용 환경. 모든 UI는 모바일 우선 설계
- **실제 서비스 배포 목적** — 개발용이 아닌 실사용자 대상 서비스
- **PWA 우선 배포** → 사용자 반응 후 Capacitor 래핑으로 앱스토어 배포 검토

## 기술 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| **Backend** | FastAPI 0.115 + SQLAlchemy 2.0 + PostgreSQL 16 | SQLite dev 지원 |
| **Frontend** | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS | PWA |
| **AI** | Google Gemini API | **Flash 모델만 사용** |
| **미디어** | ffmpeg | 프레임/GIF 추출 |
| **Storage** | 로컬 파일시스템 (`backend/uploads/`) | S3 교체 가능 |
| **인프라** | Docker Compose | 로컬/프로덕션 동일 구조 |

## 절대 규칙 (MUST)

1. **Gemini Pro 모델 절대 금지** — 과금됨. Flash 모델만 사용 (`gemini-2.5-flash`, `gemini-3.1-flash-lite-preview`)
2. **검증되지 않은 AI 판단 자동 축적 금지** — 사용자 피드백으로 검증된 데이터만 개인화에 반영
3. **모바일 UX 최우선** — 터치 타겟(44px+), 폰트 크기, safe-area, iOS/Android 호환
4. **CSS Grid 앱 셸 유지** — `#app-shell`(grid-template-rows: auto 1fr auto)로 헤더/메인/네비 레이아웃 고정

---

## 아키텍처 & 핵심 플로우

### 1. 영상 분석 플로우

```
사용자 → 영상 업로드 (POST /api/videos/upload)
  → SHA256 해시로 동일 영상 감지 (같은 디바이스 내)
  → 중복이면 기존 분석으로 안내
  → 신규면 분석 요청 (POST /api/analysis)
    → 개인화 컨텍스트 구성 (이전 3개 분석 이력 + GymProfile)
    → Gemini Flash에 영상+프롬프트 전송
    → 실패 프레임/GIF 추출 (ffmpeg)
    → 결과 저장 + 자동 통계 축적 (성공률, 완성도 등)
```

### 2. 피드백 → 재분석 루프

```
사용자 → 분석 결과 확인
  → 구조화 피드백 입력 ([정확했던 항목], [틀렸던 항목], [추가의견])
  → POST /api/analysis/{id}/feedback
    → GymProfile에 "보정사항" 저장 (최대 20개)
    → 피드백 포함하여 재분석 (revision 증가)
    → **검증된 약점만 축적** (사용자가 확인한 것)
```

### 3. 개인화 시스템

**디바이스 ID 기반** (로그인 시스템 없음)

- `GymProfile` 모델에 corrections JSON 배열로 축적:
  - `verified_weakness` — 사용자 피드백에서 확인된 약점 (카테고리별 카운트)
  - `auto_stats` — 자동: 총 시도, 성공 수, 성공률, 평균 완성도, 스킬 레벨
  - `direction`, `color`, `posture` 등 — 좌우 혼동, 색상 오인식 등 수정사항
- 프롬프트에 개인화 블록 주입: 반복 약점, 성공률, 루트 시스템 정보

### 4. 루트 찾기

```
이미지 업로드 + 홀드 색상 지정
  → 2-Pass 분석:
    Pass 1: 해당 색상 홀드 전체 감지 (좌표 + 설명)
    Pass 2: 홀드들을 연결해 루트 제안 (경로, 난이도, 전략)
  → 루트 경로를 이미지에 그려서 반환
```

### 5. AI 분석 엔진 (analyzer.py)

**모델 페일오버:**
- 1순위: `gemini-3.1-flash-lite-preview` (가장 빠름/저렴)
- 2순위: `gemini-2.5-flash` (할당량 초과 시 자동 전환)
- Pro 모델 절대 사용하지 않음

**숙련도별 분석 분기:**
- Beginner: 기본기 중심, 코칭 4개
- Intermediate: 루트리딩/무브 효율성, 코칭 3개
- Advanced: 고급 기술/정확도, 코칭 2개

**에러 처리:**
- RuntimeError → 429 (할당량 초과)
- ValueError → 502 (파싱 실패)
- Timeout → 504

---

## 디렉토리 구조

```
Climbing/
├── CLAUDE.md                    # 이 파일 — 프로젝트 전체 컨텍스트
├── README.md                    # 실행 가이드
├── docker-compose.yml           # 서비스 정의 (DB, Backend, Frontend)
├── docker-compose.prod.yml      # 프로덕션 오버라이드
│
├── backend/
│   ├── Dockerfile               # Python 3.11 + ffmpeg
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI 진입점, CORS, 라우터 등록
│       ├── db.py                # SQLAlchemy 엔진/세션 설정
│       ├── models/
│       │   └── models.py        # ORM: User, Video, AnalysisJob, AnalysisResult,
│       │                        #       AnalysisFeedback, GymProfile
│       ├── routers/
│       │   ├── videos.py        # POST /api/videos/upload (중복 감지 포함)
│       │   ├── analysis.py      # 분석 CRUD + 피드백 + 디바이스별 이력
│       │   ├── routes.py        # POST /api/routes/analyze (루트 찾기)
│       │   └── admin.py         # 디바이스별 통계
│       ├── schemas/
│       │   ├── analysis.py      # 분석 입출력 Pydantic 스키마
│       │   ├── video.py         # 영상 스키마 (is_duplicate 포함)
│       │   └── route.py         # 루트 분석 스키마
│       ├── services/
│       │   └── analyzer.py      # BaseAnalyzer + GeminiAnalyzer (핵심 AI 로직)
│       ├── repositories/
│       │   ├── analysis_repo.py # Job/Result/Feedback CRUD
│       │   ├── video_repo.py    # Video CRUD + 해시 기반 중복 감지
│       │   └── gym_repo.py      # GymProfile CRUD (개인화 데이터)
│       └── utils/
│           ├── file_utils.py    # 파일 저장 + SHA256 해시 계산
│           ├── video_utils.py   # ffmpeg 프레임/GIF 추출
│           └── route_drawer.py  # 루트 경로 이미지 드로잉
│
├── frontend/
│   ├── Dockerfile               # 멀티스테이지 빌드 (deps→builder→runner)
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx           # 루트 레이아웃 (CSS Grid 앱 셸 + BottomNav)
│   │   ├── globals.css          # #app-shell 그리드 + PWA standalone safe-area
│   │   ├── page.tsx             # 홈 (소개, 기능 카드)
│   │   ├── pwa-register.tsx     # 서비스워커 등록
│   │   ├── upload/page.tsx      # 영상 업로드 + 분석 요청
│   │   ├── analysis/[id]/page.tsx  # 분석 결과 상세 + 피드백 UI
│   │   ├── analyses/page.tsx    # 내 분석 목록 (디바이스별)
│   │   ├── route-finder/page.tsx   # 루트 찾기
│   │   └── admin/page.tsx       # 어드민 통계
│   ├── components/
│   │   ├── BottomNav.tsx        # 하단 네비 (홈, 영상분석, 루트찾기, 내분석)
│   │   ├── AnalysisResultCard.tsx  # 분석 결과 표시 (요약, 타임라인, 코칭)
│   │   ├── RouteResultCard.tsx  # 루트 분석 결과
│   │   ├── TrendChart.tsx       # 완성도 추이 그래프
│   │   └── InstallPrompt.tsx    # PWA 설치 유도 (3회 방문 후)
│   ├── lib/
│   │   ├── api.ts               # fetch 기반 API 클라이언트
│   │   └── device.ts            # 디바이스 ID 생성/관리 (localStorage)
│   └── public/
│       ├── manifest.json        # PWA 매니페스트 (share_target 포함)
│       ├── sw.js                # 서비스워커 (API: network-first, 정적: cache-first)
│       └── icons/               # 192x192, 512x512 앱 아이콘
```

---

## API 엔드포인트

### Videos
| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/videos/upload` | 영상 업로드 (100MB 제한, SHA256 중복 감지) |

### Analysis
| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/analysis` | 분석 요청 (video_id, skill_level, attempt_result, device_id) |
| `GET` | `/api/analysis/{id}` | 분석 결과 + related_analyses |
| `POST` | `/api/analysis/{id}/feedback` | 피드백 제출 → 재분석 (revision 증가) |
| `GET` | `/api/analysis/{id}/history` | 전체 분석 이력 (results + feedbacks) |
| `GET` | `/api/analysis/device/{device_id}/list` | 디바이스별 분석 목록 |

### Routes
| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/routes/analyze` | 루트 찾기 (이미지 + 홀드 색상 → 2-Pass 분석) |

### Admin
| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/api/admin/devices` | 전체 디바이스 통계 |
| `GET` | `/api/admin/devices/{device_id}` | 디바이스별 상세 |

---

## 데이터 모델

### User
- `id` (UUID), `email` (unique), `created_at`

### Video
- `id` (UUID), `device_id`, `filename`, `file_path`, `file_hash` (SHA256)
- `duration_seconds`, `created_at`
- 같은 device_id + file_hash → 중복 감지

### AnalysisJob
- `id` (UUID), `video_id` (FK), `device_id`
- `status`: queued → processing → completed/failed
- `current_revision`: 0부터 시작, 피드백마다 +1

### AnalysisResult
- `id` (UUID), `analysis_job_id` (FK), `revision`
- `summary` (Text), `result_json` (JSON — 전체 분석 결과)

### AnalysisFeedback
- `id` (UUID), `analysis_job_id` (FK), `revision_from`
- `feedback_text` (최대 2000자)

### GymProfile
- `id` (UUID), `device_id` (unique)
- `route_system`, `lighting_note`
- `corrections` (JSON array, 최대 20개) — 개인화 데이터 핵심
- `analysis_count`, `feedback_count`

---

## 분석 결과 JSON 스키마 (result_json)

```json
{
  "summary": "체중 이동 후 발이 미끄러져 실패",
  "attemptResult": "failure",
  "skillLevel": "beginner",
  "failReason": "크럭스 구간 체중 중심 이동 부족",
  "failSegment": { "startSec": 49.5, "endSec": 63.0, "description": "..." },
  "failFrameUrl": "/uploads/frames/...",
  "failGifUrl": "/uploads/gifs/...",
  "keyObservations": [
    { "timeSec": 15.2, "observation": "발 위치가 안정적임", "type": "good", "frameUrl": "..." },
    { "timeSec": 52.0, "observation": "오른발이 홀드에서 미끄러짐", "type": "issue" }
  ],
  "coachingSuggestions": [
    { "label": "발 위치 교정", "content": "52초 시점에 오른발..." }
  ],
  "postureFeedback": ["..."],
  "footworkFeedback": ["..."],
  "centerOfMassFeedback": ["..."],
  "completionProbability": 68,
  "confidence": 0.78,
  "userFeedbackApplied": false,
  "revisedPoints": [],
  "analysisReasoning": "영상에서 관찰한 근거 2~3문장"
}
```

---

## 프론트엔드 레이아웃 구조

### CSS Grid 앱 셸 (#app-shell)
```
┌─────────────────────┐
│     Header (auto)    │  ← 고정 높이
├─────────────────────┤
│                     │
│   Main Content (1fr)│  ← 스크롤 영역 (overflow-y: auto)
│                     │
├─────────────────────┤
│   BottomNav (auto)  │  ← 고정 높이, safe-area 고려
└─────────────────────┘
```

- `height: 100dvh` (100vh 폴백)
- `overflow: hidden` (셸 전체)
- `#app-main`: `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- standalone 모드: `padding-top: env(safe-area-inset-top)`

---

## PWA 설정

- **manifest.json**: standalone, share_target (영상 공유로 바로 업로드)
- **sw.js**: API는 network-first, 정적 리소스는 cache-first
- **InstallPrompt**: 3회 방문 후 설치 유도 (iOS: "공유→홈화면에 추가", Android: install 버튼)

---

## BM 모델 & 상용화 로드맵

### Phase 1: 크레딧 시스템 (구현 예정)
- 디바이스 ID 기반 하루 3회 무료 분석
- 3회 초과 시 차단 → 광고 시청 또는 구매로 크레딧 획득
- 백엔드: `user_credits` 테이블, 크레딧 확인/차감/충전 API
- 프론트: 분석 전 크레딧 체크 → 부족 시 광고/결제 모달

### Phase 2: 리워드 광고 (앱 배포 후)
- Capacitor + AdMob 리워드 광고
- 광고 시청 완료 → SSV(Server-Side Verification)로 검증 → 크레딧 +1
- 웹에서는 리워드 광고 지원이 제한적이므로 네이티브 앱에서만

### Phase 3: 프리미엄 구독 (선택)
- 무제한 분석, 광고 제거
- 상세 통계 대시보드, 성장 리포트
- 짐 커뮤니티 기능 (루트 공유 등)

### 배포 비용
| 항목 | 비용 |
|---|---|
| PWA (현재) | 무료 (서버 비용만) |
| Google Play | 1회 $25 (~3.3만원) |
| Apple App Store | 연 $99 (~13만원) |

### 수익 구조 요약
```
무료 사용자: 하루 3회 → 광고 시청으로 추가 분석
유료 사용자: 월 구독 → 무제한 분석 + 광고 제거
짐 제휴: B2B → 짐에 분석 서비스 제공 (별도 계약)
```

---

## DB 참고

- Alembic 미사용 — 스키마 변경 시 수동 SQL 필요
- Docker: `climbing_user` / `climbing_db` (포트 5433 외부, 5432 내부)
- init_db()에서 전체 테이블 자동 생성 (User, Video, AnalysisJob, AnalysisResult, AnalysisFeedback, GymProfile)

## 개발 참고

- 프론트엔드 코드 수정 시 `docker compose build --no-cache frontend && docker compose up -d frontend` 필요 (restart만으로는 반영 안 됨 — standalone 빌드)
- 백엔드는 볼륨 마운트로 코드 변경 시 `docker compose restart backend`만으로 반영
- FastAPI 라우터 순서 주의: 구체적 경로(`/device/{id}/list`)를 파라미터 경로(`/{id}`) 보다 위에 배치
