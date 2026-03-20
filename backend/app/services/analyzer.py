import json
import logging
import os
import re
import time
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, duration_seconds: float, video_path: Optional[str] = None,
                memo: Optional[str] = None, skill_level: str = "beginner",
                attempt_result: str = "failure") -> dict:
        pass

    @abstractmethod
    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        pass

    @abstractmethod
    def analyze_route(self, image_path: str, hold_color: str,
                      skill_level: str = "beginner", start_hint: str = "") -> dict:
        pass


# ─────────────────────────────────────────
# Google Gemini Analyzer
# ─────────────────────────────────────────

_FAILURE_SCHEMA = """{
  "summary": "전체 시도 요약 (2~3문장)",
  "attemptResult": "failure",
  "skillLevel": "beginner 또는 expert",
  "failReason": "실패 핵심 원인 (한 문장)",
  "failSegment": {
    "startSec": <실패 구간 시작 초 (숫자)>,
    "endSec": <실패 구간 종료 초 (숫자)>,
    "description": "해당 구간 상세 설명"
  },
  "successHighlights": null,
  "keyObservations": [
    {"timeSec": <초>, "observation": "해당 시점에서 관찰한 구체적 동작 또는 문제 (한 문장)", "type": "issue"},
    {"timeSec": <초>, "observation": "잘된 동작이 있다면 기록", "type": "good"},
    {"timeSec": <초>, "observation": "참고할 만한 동작 패턴", "type": "note"}
  ],
  "coachingSuggestions": [
    {"label": "코칭 항목 이름 (AI가 직접 작성)", "content": "상세 내용 (30자 이상)"}
  ],
  "postureFeedback": ["자세 피드백 1", "자세 피드백 2"],
  "footworkFeedback": ["발 피드백 1", "발 피드백 2"],
  "centerOfMassFeedback": ["무게중심 피드백 1", "무게중심 피드백 2"],
  "completionProbability": <다음 시도 예상 성공 확률 20~100>,
  "confidence": <분석 신뢰도 0.0~1.0>,
  "userFeedbackApplied": false,
  "revisedPoints": [],
  "questionAnswer": null,
  "analysisReasoning": "영상에서 관찰한 핵심 근거 2~3문장. 어떤 동작·타이밍·자세를 보고 이 분석 결과를 도출했는지 설명"
}"""

_SUCCESS_SCHEMA = """{
  "summary": "전체 시도 요약 — 완등 성공을 축하하며 잘된 점 중심으로 (2~3문장)",
  "attemptResult": "success",
  "skillLevel": "beginner 또는 expert",
  "failReason": null,
  "failSegment": null,
  "successHighlights": ["잘된 점 1 (구체적 동작/기술)", "잘된 점 2", "잘된 점 3"],
  "keyObservations": [
    {"timeSec": <초>, "observation": "성공을 이끈 핵심 동작 (한 문장)", "type": "good"},
    {"timeSec": <초>, "observation": "관찰된 기술적 특징", "type": "note"},
    {"timeSec": <초>, "observation": "개선 여지가 있는 동작 (있다면)", "type": "issue"}
  ],
  "coachingSuggestions": [
    {"label": "코칭 항목 이름 (AI가 직접 작성)", "content": "상세 내용 (30자 이상)"}
  ],
  "postureFeedback": ["자세 개선 포인트 또는 잘된 점"],
  "footworkFeedback": ["발 위치 개선 포인트 또는 잘된 점"],
  "centerOfMassFeedback": ["무게중심 개선 포인트 또는 잘된 점"],
  "completionProbability": <이번 시도의 기술 완성도 점수 20~100>,
  "confidence": <분석 신뢰도 0.0~1.0>,
  "userFeedbackApplied": false,
  "revisedPoints": [],
  "questionAnswer": null,
  "analysisReasoning": "영상에서 관찰한 핵심 근거 2~3문장. 어떤 동작·타이밍·자세를 보고 이 분석 결과를 도출했는지 설명"
}"""


def _extract_json(text: str) -> dict:
    """LLM 응답에서 가장 바깥쪽 JSON 객체를 추출하여 파싱"""
    start = text.find("{")
    if start == -1:
        raise ValueError(f"JSON을 찾을 수 없습니다. 응답: {text[:300]}")
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
    raise ValueError(f"JSON 파싱 실패 — 닫히지 않은 중괄호. 응답: {text[:300]}")


# 우선 시도 모델 → 할당량 초과 시 fallback 순서
_MODELS = [
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash",
]

# 이미지 분석(루트 파인더)도 Flash 사용 (Pro는 과금되므로 제외)
# 2-Pass 분석으로 인식률 보완
_ROUTE_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite-preview",
]

_MIME_MAP = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
}

_IMAGE_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}

_ROUTE_SCHEMA = """{
  "wallDescription": "벽의 전체적인 구조와 특징 설명 (2~3문장)",
  "holdColor": "사용자가 지정한 홀드 색상",
  "identifiedHolds": <해당 색상 홀드 수 (숫자)>,
  "routes": [
    {
      "name": "루트 이름 (예: 왼쪽 직선 루트)",
      "difficulty": "예상 난이도 (예: V2~V3)",
      "description": "루트 전체 흐름 요약 (1~2문장)",
      "holds": [
        {"xPct": <홀드 중심의 X 좌표 (이미지 너비 대비 백분율 0~100)>, "yPct": <Y 좌표 (이미지 높이 대비 백분율 0~100)>, "label": "시작"},
        {"xPct": <X좌표>, "yPct": <Y좌표>, "label": "2"},
        {"xPct": <X좌표>, "yPct": <Y좌표>, "label": "3"},
        {"xPct": <X좌표>, "yPct": <Y좌표>, "label": "탑"}
      ],
      "steps": [
        "1. 시작: 하단 왼쪽 홀드를 양손으로 잡고 발을 풋홀드에 올림",
        "2. 오른손을 중간 높이 사이드풀로 이동 — 이때 무게중심을 왼발에 유지",
        "3. ..."
      ],
      "approachStrategy": "이 루트를 성공하기 위한 핵심 전략과 접근 방법 (3~5문장)",
      "keyTips": ["핵심 팁 1", "핵심 팁 2", "핵심 팁 3"]
    }
  ],
  "generalAdvice": "이 벽에서 전반적으로 주의할 점과 추가 조언 (2~3문장)",
  "confidence": <분석 신뢰도 0.0~1.0>
}"""


class GeminiAnalyzer(BaseAnalyzer):
    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai
        self._models = {m: genai.GenerativeModel(m) for m in _MODELS}
        # 루트 분석용 모델 (2-Pass)
        for m in _ROUTE_MODELS:
            if m not in self._models:
                self._models[m] = genai.GenerativeModel(m)

    def _upload_video(self, video_path: str):
        """Gemini Files API에 영상 업로드 후 처리 완료 대기"""
        ext = os.path.splitext(video_path)[1].lower()
        mime_type = _MIME_MAP.get(ext, "video/mp4")
        logger.info("[Gemini] 영상 업로드 시작: %s (%s)", video_path, mime_type)
        video_file = self._genai.upload_file(path=video_path, mime_type=mime_type)

        # 처리 완료 대기 (최대 120초)
        wait = 0
        while video_file.state.name == "PROCESSING" and wait < 120:
            time.sleep(3)
            wait += 3
            video_file = self._genai.get_file(video_file.name)

        if video_file.state.name != "ACTIVE":
            raise ValueError(f"영상 처리 실패: state={video_file.state.name}")

        logger.info("[Gemini] 영상 업로드 완료: %s", video_file.name)
        return video_file

    def _call(self, contents) -> tuple:
        """모델 순서대로 시도, 할당량/에러 시 다음 모델로 fallback.
        Returns: (result_dict, model_name_used)
        """
        last_err = None
        for model_name in _MODELS:
            try:
                logger.info("[Gemini] 모델 호출 시도: %s", model_name)
                response = self._models[model_name].generate_content(contents)
                result = _extract_json(response.text)
                logger.info("[Gemini] 응답 수신 완료 (%s)", model_name)
                return result, model_name
            except Exception as e:
                err_str = str(e).lower()
                if any(k in err_str for k in ["quota", "rate", "429", "resource_exhausted", "limit"]):
                    logger.warning("[Gemini] %s 할당량 초과 → 다음 모델 시도: %s", model_name, e)
                    last_err = e
                    continue
                raise
        raise RuntimeError(f"모든 모델 할당량 초과: {last_err}")

    def _call_route(self, contents) -> tuple:
        """루트 분석 전용 호출 — _ROUTE_MODELS 순서로 시도"""
        last_err = None
        for model_name in _ROUTE_MODELS:
            try:
                logger.info("[Gemini] 루트 분석 모델 호출: %s", model_name)
                response = self._models[model_name].generate_content(contents)
                result = _extract_json(response.text)
                logger.info("[Gemini] 루트 분석 응답 수신 (%s)", model_name)
                return result, model_name
            except Exception as e:
                err_str = str(e).lower()
                if any(k in err_str for k in ["quota", "rate", "429", "resource_exhausted", "limit"]):
                    logger.warning("[Gemini] %s 할당량 초과 → 다음 모델: %s", model_name, e)
                    last_err = e
                    continue
                raise
        raise RuntimeError(f"루트 분석 모든 모델 할당량 초과: {last_err}")

    def _detect_holds(self, image_file, hold_color: str, start_hint: str = "") -> list:
        """Pass 1: 이미지에서 해당 루트의 홀드를 모두 찾아 좌표 리스트 반환"""
        hint_section = ""
        if start_hint:
            hint_section = f"""
[★ 사용자가 제공한 시작점 힌트 ★]
"{start_hint}"
이 정보를 활용하여 시작 홀드를 먼저 찾고, 거기서부터 같은 루트에 속하는 홀드를 추적하세요.

"""
        prompt = f"""당신은 클라이밍 홀드 인식 전문가입니다.

첨부된 클라이밍 벽 사진에서 "{hold_color}"에 해당하는 홀드를 **모두** 찾으세요.
{hint_section}
[한국 클라이밍 짐 홀드 식별 — 핵심 원리]

**★ 가장 중요한 원칙: 같은 번호 스티커가 붙은 홀드들은 모두 하나의 루트입니다. ★**
- 시작(스타트) 홀드에도 "6"번 스티커, 중간 홀드에도 "6"번 스티커, 탑 홀드에도 "6"번 스티커가 붙어 있습니다.
- 따라서 "6번"을 찾으라는 요청은 "6이 적힌 스티커가 붙은 홀드를 아래부터 위까지 전부 찾으라"는 뜻입니다.
- 벽 아래쪽부터 위쪽까지 체계적으로 스캔하며 해당 번호/색의 스티커를 모두 찾으세요.

루트 구분 방식 3가지:
1. **숫자 스티커 시스템**: 홀드 옆/위에 동그란 스티커, 안에 숫자 → 같은 숫자 = 같은 루트
2. **같은 색상 홀드 시스템**: 같은 색 홀드끼리 한 루트
3. **테이프 시스템**: 홀드 옆 같은 색 테이프 = 같은 루트

[검색 전략 — 이 순서대로 진행]
1. 벽의 **가장 아래쪽**부터 시작하여 위로 올라가며 스캔
2. 각 높이 구간(하단/중하단/중단/중상단/상단)에서 좌→우로 훑으며 해당 스티커/색상 탐색
3. 홀드를 하나 찾으면, 그 **주변 50~80cm 범위**에 같은 번호의 다음 홀드가 있을 가능성이 높음
4. 스티커가 작아서 잘 안 보여도, 홀드 옆에 작은 원형 태그가 있으면 포함

[핵심 지시사항]
- 하나의 볼더 루트에는 보통 **8~15개의 홀드**가 있습니다. 3~4개만 찾는 것은 명백한 오류입니다.
- 확실하지 않은 홀드도 "uncertain": true로 포함하세요.

아래 JSON 형식으로만 응답하세요:

{{
  "routeSystem": "이 짐의 루트 구분 방식 (sticker/color/tape 중 택1)",
  "totalFound": <찾은 홀드 수>,
  "holds": [
    {{"xPct": <왼쪽 0~100>, "yPct": <위쪽 0~100>, "description": "홀드 설명 (모양, 크기, 스티커 등)", "uncertain": false}},
    ...
  ]
}}

**holds를 yPct 내림차순(가장 아래→가장 위) 순서로 정렬하세요.**
최소 6개 이상 찾아야 합니다. 6개 미만이면 다시 사진을 살펴보세요."""

        contents = [image_file, prompt]
        result, _ = self._call_route(contents)
        holds = result.get("holds", [])
        route_system = result.get("routeSystem", "unknown")
        logger.info("[Gemini] Pass 1 홀드 감지: %d개 (시스템: %s)", len(holds), route_system)
        return holds, route_system

    def _delete_file(self, video_file):
        try:
            self._genai.delete_file(video_file.name)
            logger.info("[Gemini] 업로드 파일 삭제: %s", video_file.name)
        except Exception:
            pass

    def analyze(self, duration_seconds: float, video_path: Optional[str] = None,
                memo: Optional[str] = None, skill_level: str = "beginner",
                attempt_result: str = "failure") -> dict:
        logger.info("[Gemini] analyze() — duration=%.1fs, skill_level=%s, attempt_result=%s, video=%s",
                    duration_seconds, skill_level, attempt_result, video_path)
        # 개인화 컨텍스트는 프롬프트 최상단에 강제 지시로 배치
        personalization_block = ""
        if memo:
            personalization_block = f"""
[★★★ 필수 반영 — 이 사용자의 개인화 데이터 ★★★]
아래는 이 사용자의 이전 분석에서 축적된 데이터입니다.
이 정보를 이번 분석에 **반드시 반영**하세요. 무시하면 분석 품질이 떨어집니다.

{memo}
[개인화 데이터 끝]
"""
        memo_text = ""  # memo는 personalization_block으로 대체
        is_success = attempt_result == "success"

        # 3단계 스킬 레벨 분기
        skill_config = {
            "beginner": {
                "label": "입문자 (0~6개월)",
                "coaching_count": 4,
                "coaching_rule": "coachingSuggestions는 정확히 4개 작성하세요. 순서대로: 1)기본 자세 교정, 2)발 위치와 체중 이동, 3)반복 훈련 방법, 4)심리 안정과 호흡. 각 항목은 30자 이상 초보자 눈높이에서 상세히 작성하세요.",
                "analysis_focus": "기초 자세, 발 위치, 그립 방법, 체중 이동 등 기본기 중심으로 분석하세요. 전문 용어보다 쉬운 표현을 사용하세요.",
                "obs_count": "4~5개",
            },
            "intermediate": {
                "label": "중급자 (6개월~2년)",
                "coaching_count": 3,
                "coaching_rule": "coachingSuggestions는 정확히 3개 작성하세요. 순서대로: 1)무브 효율 및 루트 리딩, 2)에너지 배분과 레스트 전략, 3)크럭스 구간 공략. 각 항목은 40자 이상 구체적으로 작성하세요.",
                "analysis_focus": "루트 리딩 능력, 무브 효율성, 에너지 배분, 동적/정적 무브 선택, 크럭스 구간 전략 중심으로 분석하세요. 기본기는 갖춰진 것으로 가정하고 중급 기술에 집중하세요.",
                "obs_count": "3~5개",
            },
            "advanced": {
                "label": "상급자 (2년+)",
                "coaching_count": 2,
                "coaching_rule": "coachingSuggestions는 정확히 2개 작성하세요. 각 항목은 '구체적 동작+루트 전략+반복 훈련+심리/타이밍' 4요소를 자연스럽게 결합하여 2~4문장으로 압축 작성합니다.",
                "analysis_focus": "다이나믹 무브 정확도, 데드포인트/랜지 타이밍, 미세한 체중 이동, 고급 풋워크(토훅/힐훅/스미어링), 루트 전체의 흐름과 리듬 중심으로 분석하세요. 핵심만 간결하게 제시하세요.",
                "obs_count": "3~4개",
            },
        }
        cfg = skill_config.get(skill_level, skill_config["beginner"])
        coaching_rule = cfg["coaching_rule"]

        if is_success:
            context = f"""사용자가 이번 시도에서 완등(성공)했습니다.
실패 분석을 하지 말고, 이번 성공에서 잘된 점을 찾아 긍정적으로 분석하세요.
successHighlights에 이번 성공의 핵심 요인 3가지를 구체적으로 작성하세요.
successProbabilityBreakdown의 각 지표는 '이번 시도의 기술 완성도'를 평가합니다.
completionProbability는 '기술 완성도 점수'로, 높을수록 더 완성된 등반입니다.
coachingSuggestions는 더 높은 난이도 도전 또는 더 효율적인 등반을 위한 개선 방향으로 작성하세요."""
            schema = _SUCCESS_SCHEMA
        else:
            context = f"""사용자가 이번 시도에서 실패했습니다.
실패 원인을 정확히 분석하고 다음 시도에서 완등할 수 있는 전략을 제안하세요.
failReason과 failSegment를 반드시 작성하세요.
successProbabilityBreakdown의 각 지표는 '개선 시 다음 시도 성공 가능성'을 평가합니다.
completionProbability는 '다음 시도 예상 성공 확률'입니다."""
            schema = _FAILURE_SCHEMA

        has_video = bool(video_path and os.path.exists(video_path))
        dur_int = int(duration_seconds)
        video_instruction = (
            f"첨부된 클라이밍 영상을 직접 분석하세요. 영상 총 길이: {dur_int}초.\n"
            "영상에서 실제로 관찰한 내용을 바탕으로 구체적으로 작성하세요.\n"
            "추측이나 일반론이 아닌, 이 영상에서만 볼 수 있는 구체적 동작을 근거로 분석하세요.\n\n"
            "[클라이밍 영상 분석 핵심]\n"
            "- 클라이머가 어떤 색상의 홀드(또는 테이프로 표시된 루트)를 따라 올라가는지 먼저 식별하세요.\n"
            "- **시작 홀드**: 영상 초반에 클라이머가 양손으로 잡는 가장 아래쪽 홀드. 보통 테이프 2개 또는 'S' 표시가 있습니다.\n"
            "- **탑 홀드**: 루트의 가장 위쪽 홀드. 클라이머가 이 홀드를 양손으로 잡으면 완등(성공)입니다.\n"
            "- 클라이머가 시작 홀드에서 출발하여 어디까지 진행했는지, 어느 홀드에서 떨어졌는지를 기준으로 분석하세요.\n"
            "- 해당 루트에 속하지 않는 다른 색 홀드를 발로 밟는 것은 허용되는 짐도 있고 아닌 짐도 있습니다."
            if has_video else
            f"영상 길이: {duration_seconds:.1f}초 (영상 파일 없음 — 제공된 정보로만 분석)"
        )

        prompt = f"""당신은 10년 경력의 전문 클라이밍 코치입니다.
{personalization_block}
{video_instruction}
사용자 숙련도: {cfg["label"]}
시도 결과: {"✅ 완등 성공" if is_success else "❌ 실패"}

[숙련도별 분석 지침]
{cfg["analysis_focus"]}

{context}

[절대 규칙 — 타임스탬프]
- 이 영상의 총 길이는 {dur_int}초입니다.
- 모든 timeSec, startSec, endSec 값은 반드시 0 이상 {dur_int} 이하여야 합니다.
- {dur_int}초를 초과하는 타임스탬프는 절대 작성하지 마세요.

[절대 규칙 — 분석 품질]
- "무게중심이 불안정합니다", "자세가 좋지 않습니다" 같은 일반적인 표현은 금지합니다.
- 반드시 "XX초에 오른발이 홀드에서 미끄러지면서 골반이 벽에서 30cm 이상 벌어짐" 같이 구체적 시점 + 구체적 신체 부위 + 구체적 현상을 포함하세요.
- 코칭 제안도 "발을 더 잘 디디세요" 같은 추상적 조언 대신, 이 영상의 특정 구간에서 어떤 동작을 어떻게 바꿔야 하는지 작성하세요.
- summary는 이 영상만의 고유한 특징을 반영해야 합니다. 어떤 영상에나 쓸 수 있는 문장은 금지합니다.

[절대 규칙 — 좌/우 구분 (매우 중요)]
- 모든 좌/우 표현은 **카메라(관찰자) 시점**이 아니라 **클라이머 본인 시점** 기준으로 작성하세요.
- 클라이머가 벽을 바라보고 있으므로: 화면상 왼쪽 = 클라이머의 오른쪽, 화면상 오른쪽 = 클라이머의 왼쪽.
- "왼손", "오른손", "왼발", "오른발"을 쓸 때 반드시 해당 프레임에서 실제로 움직이는 손/발을 확인한 후 작성하세요.
- 확신이 없으면 "한 손" 또는 "한 발"로 표현하세요. 잘못된 좌/우보다 모호한 표현이 낫습니다.

[절대 규칙 — 홀드 색상 식별]
- 홀드 색상을 언급할 때는 영상에서 **직접 확인한 색상만** 작성하세요.
- 조명에 따라 색이 다르게 보일 수 있습니다. 확실하지 않으면 "밝은 색 홀드", "어두운 색 홀드"로 표현하세요.
- 홀드 색상과 테이프/스티커 색상을 혼동하지 마세요. 루트 표시(테이프/스티커)와 홀드 자체의 색은 다를 수 있습니다.
- 같은 홀드를 다른 시점에서 다른 색으로 부르지 마세요. 일관성을 유지하세요.

[절대 규칙 — 동작 유형 판별]
- "다이나믹 무브", "랜지", "데드포인트" 등 고급 기술 용어는 영상에서 해당 동작이 **실제로 명확히 관찰**될 때만 사용하세요.
- 다이나믹 무브: 두 손 또는 두 발이 동시에 벽에서 떨어지며 점프하는 동작이 보일 때만.
- 정적(스태틱) 이동인데 "다이나믹"이라고 쓰면 안 됩니다. 판단이 모호하면 "정적 이동"으로 기술하세요.
- 영상에서 보이지 않는 기술을 추천하거나 관찰했다고 거짓 기술하지 마세요.

[절대 규칙 — 자기검증 (출력 전 반드시 수행)]
JSON을 출력하기 직전에 아래 항목을 스스로 점검하세요:
1. "왼손/오른손/왼발/오른발"을 쓴 곳마다 — 해당 프레임에서 실제 움직이는 손/발과 일치하는가?
2. 홀드 색상을 언급한 곳마다 — 영상에서 실제로 그 색인가? 일관되게 같은 색으로 부르고 있는가?
3. 타임스탬프 — 0~{dur_int} 범위를 벗어나지 않는가?
4. 동적 무브 주장 — 영상에서 실제 점프/런지가 보이는가?
틀린 것이 있으면 수정한 뒤 출력하세요.

[핵심 관찰 포인트 규칙 - 필수]
keyObservations에 영상에서 관찰한 핵심 순간 {cfg["obs_count"]}를 작성하세요.
- timeSec: 영상에서 실제 관찰된 시점 (0~{dur_int} 범위, 초 단위)
- observation: 해당 시점에서 일어난 구체적 동작 (한 문장, 30자 이상)
- type: "issue"(문제 동작), "good"(잘된 동작), "note"(참고 패턴)

[코칭 제안 규칙 - 필수]
{coaching_rule}
coachingSuggestions의 각 항목은 {{"label": "항목 이름", "content": "상세 내용"}} 형식으로 작성하세요.
label은 해당 코칭의 핵심을 2~5단어로 직접 작성하세요 (예: "발 위치 교정", "데드포인트 타이밍").

[completionProbability 규칙]
{"실패 시: 개선 사항을 모두 적용했을 때의 다음 시도 예상 성공 확률 (20~100)." if not is_success else "성공 시: 이번 시도의 기술 완성도 점수 (20~100)."}
{"failSegment의 startSec/endSec은 0~" + str(dur_int) + " 범위 내에서 실제 관찰된 실패 구간을 작성하세요." if has_video and not is_success else ""}

아래 JSON 형식으로만 응답하세요. 추가 텍스트 없이 JSON만 출력하세요.

{schema}"""

        video_file = None
        try:
            if has_video:
                video_file = self._upload_video(video_path)
                contents = [video_file, prompt]
            else:
                contents = prompt
            result, model_used = self._call(contents)
        finally:
            if video_file:
                self._delete_file(video_file)

        # 타임스탬프 검증/보정
        result = self._clamp_timestamps(result, duration_seconds)

        result["skillLevel"] = skill_level
        result["attemptResult"] = attempt_result
        result["modelUsed"] = model_used
        return result

    @staticmethod
    def _clamp_timestamps(result: dict, max_sec: float) -> dict:
        """모든 타임스탬프가 영상 길이를 초과하지 않도록 보정"""
        # failSegment
        fs = result.get("failSegment")
        if fs and isinstance(fs, dict):
            fs["startSec"] = max(0, min(fs.get("startSec", 0), max_sec))
            fs["endSec"] = max(0, min(fs.get("endSec", 0), max_sec))
            if fs["startSec"] > fs["endSec"]:
                fs["startSec"], fs["endSec"] = fs["endSec"], fs["startSec"]

        # keyObservations
        obs_list = result.get("keyObservations")
        if obs_list and isinstance(obs_list, list):
            for obs in obs_list:
                if isinstance(obs, dict) and "timeSec" in obs:
                    obs["timeSec"] = max(0, min(obs["timeSec"], max_sec))

        return result

    def analyze_route(self, image_path: str, hold_color: str,
                      skill_level: str = "beginner", start_hint: str = "") -> dict:
        logger.info("[Gemini] analyze_route() 2-Pass — color=%s, skill=%s, hint=%s, image=%s",
                    hold_color, skill_level, start_hint, image_path)

        ext = os.path.splitext(image_path)[1].lower()
        mime_type = _IMAGE_MIME_MAP.get(ext, "image/jpeg")
        image_file = self._genai.upload_file(path=image_path, mime_type=mime_type)

        try:
            wait = 0
            while image_file.state.name == "PROCESSING" and wait < 60:
                time.sleep(2)
                wait += 2
                image_file = self._genai.get_file(image_file.name)

            # ── Pass 1: 홀드 감지 ──
            detected_holds, route_system = self._detect_holds(image_file, hold_color, start_hint)

            # ── Pass 2: 루트 구성 + 공략 (감지된 홀드 정보 주입) ──
            route_skill = {
                "beginner": {"label": "입문자", "count": "2~3개", "detail": "각 스텝은 구체적 동작과 무게중심/발 위치 등을 초보자가 이해하기 쉽게 상세히 설명하세요."},
                "intermediate": {"label": "중급자", "count": "2~3개", "detail": "각 스텝은 무브 이름과 체중 이동 방향을 포함하여 실전적으로 작성하세요."},
                "advanced": {"label": "상급자", "count": "1~2개", "detail": "각 스텝은 핵심 동작만 간결하게 작성하세요."},
            }
            rcfg = route_skill.get(skill_level, route_skill["beginner"])
            route_count = rcfg["count"]
            step_detail = rcfg["detail"]

            # Pass 1 결과를 텍스트로 변환
            holds_text = json.dumps(detected_holds, ensure_ascii=False, indent=2)
            hold_count = len(detected_holds)

            start_hint_text = f'\n사용자가 알려준 시작점 힌트: "{start_hint}"' if start_hint else ""
            prompt = f"""당신은 10년 경력의 전문 클라이밍 코치이자 루트세터입니다.

첨부된 클라이밍 벽 사진을 분석하고, **사전 감지된 홀드 정보**를 참고하여 루트를 구성하세요.

사용자가 도전하려는 홀드: **{hold_color}**{start_hint_text}
사용자 숙련도: {rcfg["label"]}

[★ 사전 감지된 홀드 목록 (AI 1차 분석 결과) ★]
총 {hold_count}개 홀드가 감지되었습니다:
{holds_text}

위 좌표들은 1차 분석에서 감지된 것입니다.
- 사진을 직접 다시 확인하여 **위 좌표가 실제 홀드 위치와 맞는지 검증**하세요.
- 1차 분석에서 누락된 홀드가 보이면 **추가**하세요.
- 잘못된 좌표가 있으면 **수정**하세요.
- uncertain: true인 홀드는 사진에서 재확인하여 포함 여부를 결정하세요.

[루트 구성 규칙]
1. 감지된 홀드 중 **가장 아래쪽(yPct가 가장 큰)** 1~2개가 **스타트 홀드**입니다.
2. **가장 위쪽(yPct가 가장 작은)** 홀드가 **탑 홀드**입니다.
3. 스타트부터 탑까지 자연스러운 클라이밍 경로로 연결하세요.
4. 홀드 간 거리, 각도, 몸의 리치를 고려하여 현실적인 루트를 구성하세요.
5. 직선으로 올라가는 루트는 거의 없습니다. 좌우 이동이 포함된 자연스러운 경로를 만드세요.

[각 루트 작성 규칙]
- holds 배열: 감지된 좌표를 기반으로, 실제 등반 순서대로 정렬
- 반드시 **첫 홀드 = "시작"**, **마지막 홀드 = "탑"** 지정
- 중간 홀드: 등반 순서대로 "2", "3", "4" ...
- 루트 {route_count}를 제안하세요
- steps: 스타트부터 탑까지 이동 순서. {step_detail}
- approachStrategy: 루트 공략 전략 (3~5문장)
- keyTips: 핵심 팁 2~3개
- difficulty: V-스케일 추정

[좌표 정확도 — 매우 중요]
- 홀드가 {hold_count}개 감지되었으므로 루트에 최소 {max(hold_count - 2, 6)}개의 홀드를 포함하세요.
- 좌표(xPct, yPct)는 사진에서 **실제 홀드가 보이는 위치**를 정밀하게 반영하세요.

아래 JSON 형식으로만 응답하세요. 추가 텍스트 없이 JSON만 출력하세요.

{_ROUTE_SCHEMA}"""

            contents = [image_file, prompt]
            result, model_used = self._call_route(contents)
        finally:
            try:
                self._genai.delete_file(image_file.name)
            except Exception:
                pass

        result["holdColor"] = hold_color
        result["modelUsed"] = model_used
        result["detectedHoldsCount"] = len(detected_holds)
        result["routeSystem"] = route_system
        return result

    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        skill_level = original_result.get("skillLevel", "beginner")
        attempt_result = original_result.get("attemptResult", "failure")
        is_success = attempt_result == "success"
        is_question = any(k in feedback_text for k in ["?", "？", "어떻게", "왜", "언제", "뭐", "무엇", "어디", "얼마나", "차이", "알려줘", "설명해"])

        schema = _SUCCESS_SCHEMA if is_success else _FAILURE_SCHEMA
        reanalyze_coaching = {
            "beginner": "coachingSuggestions는 정확히 4개(기본자세/발위치/훈련/심리 각 1개씩), 피드백을 반영하여 초보자 눈높이로 상세히 재작성하세요.",
            "intermediate": "coachingSuggestions는 정확히 3개(무브효율/에너지배분/크럭스공략), 피드백을 반영하여 중급자 수준으로 재작성하세요.",
            "advanced": "coachingSuggestions는 정확히 2개, 4요소를 압축하여 재작성하세요.",
        }
        coaching_rule = reanalyze_coaching.get(skill_level, reanalyze_coaching["beginner"])
        qa_rule = (
            f'사용자가 질문을 했습니다: "{feedback_text}"\n'
            '"questionAnswer" 필드에 이 질문에 대한 명확하고 실용적인 답변을 작성하세요. (3~5문장)\n'
            if is_question else
            '"questionAnswer"는 null로 설정하세요.\n'
        )
        result_type_note = (
            "이번 시도는 성공(완등)입니다. failReason과 failSegment는 null로 유지하고, successHighlights를 중심으로 분석하세요."
            if is_success else
            "이번 시도는 실패입니다. 피드백을 반영하여 failReason, failSegment, 개선 전략을 재작성하세요."
        )

        prompt = f"""당신은 10년 경력의 전문 클라이밍 코치입니다. 이전 분석 결과에 사용자 피드백을 반영하여 재분석합니다.

이전 분석 결과:
{json.dumps(original_result, ensure_ascii=False, indent=2)}

사용자 피드백 (revision {revision}):
{feedback_text}

[처리 규칙]
{result_type_note}
{qa_rule}
- "userFeedbackApplied"는 반드시 true로 설정하세요.
- "revisedPoints"에 이번에 변경된 항목을 간략히 나열하세요.
- keyObservations를 피드백을 반영하여 재작성하세요. timeSec/observation/type 형식 유지.
- coachingSuggestions의 각 항목은 {{"label": "항목 이름", "content": "상세 내용"}} 형식으로 작성하세요.
- {coaching_rule}
- 추가 텍스트 없이 JSON만 출력하세요.

{schema}"""
        result, model_used = self._call(prompt)
        result["userFeedbackApplied"] = True
        result["skillLevel"] = skill_level
        result["attemptResult"] = attempt_result
        result["modelUsed"] = model_used
        return result


# ─────────────────────────────────────────
# Factory — GOOGLE_API_KEY 필수
# ─────────────────────────────────────────

def get_analyzer() -> BaseAnalyzer:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.")
    logger.info("[Analyzer] GeminiAnalyzer 사용")
    return GeminiAnalyzer(api_key=api_key)
