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
                      skill_level: str = "beginner") -> dict:
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
        memo_text = f"\n사용자 메모: {memo}" if memo else ""
        is_expert = skill_level == "expert"
        is_success = attempt_result == "success"

        coaching_rule = (
            "coachingSuggestions는 정확히 2개 작성하세요. 각 항목은 '구체적 동작+루트 전략+반복 훈련+심리/타이밍' 4요소를 자연스럽게 결합하여 2~4문장으로 압축 작성합니다."
            if is_expert else
            "coachingSuggestions는 정확히 4개 작성하세요. 순서대로: 1)동작 및 순서, 2)루트 접근 전략, 3)반복 훈련 방법, 4)심리 및 타이밍. 각 항목은 30자 이상 상세히 작성하세요."
        )

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
        video_instruction = (
            "첨부된 클라이밍 영상을 직접 분석하세요. 영상에서 실제로 관찰한 내용을 바탕으로 구체적으로 작성하세요."
            if has_video else
            f"영상 길이: {duration_seconds:.1f}초 (영상 파일 없음 — 제공된 정보로만 분석)"
        )

        prompt = f"""당신은 10년 경력의 전문 클라이밍 코치입니다.

{video_instruction}
사용자 숙련도: {"숙련자" if is_expert else "초보자"}
시도 결과: {"✅ 완등 성공" if is_success else "❌ 실패"}{memo_text}

{context}

[핵심 관찰 포인트 규칙 - 필수]
keyObservations에 영상에서 관찰한 핵심 순간 3~5개를 작성하세요.
- timeSec: 영상에서 실제 관찰된 시점 (초 단위)
- observation: 해당 시점에서 일어난 구체적 동작 (한 문장, 30자 이상)
- type: "issue"(문제 동작), "good"(잘된 동작), "note"(참고 패턴)

[코칭 제안 규칙 - 필수]
{coaching_rule}
coachingSuggestions의 각 항목은 {{"label": "항목 이름", "content": "상세 내용"}} 형식으로 작성하세요.
label은 해당 코칭의 핵심을 2~5단어로 직접 작성하세요 (예: "발 위치 교정", "데드포인트 타이밍").

[completionProbability 규칙]
{"실패 시: 개선 사항을 모두 적용했을 때의 다음 시도 예상 성공 확률 (20~100)." if not is_success else "성공 시: 이번 시도의 기술 완성도 점수 (20~100)."}
{"failSegment의 startSec/endSec은 영상에서 실제로 관찰된 실패 구간의 타임스탬프를 초 단위로 작성하세요." if has_video and not is_success else ""}

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

        result["skillLevel"] = skill_level
        result["attemptResult"] = attempt_result
        result["modelUsed"] = model_used
        return result

    def analyze_route(self, image_path: str, hold_color: str,
                      skill_level: str = "beginner") -> dict:
        logger.info("[Gemini] analyze_route() — color=%s, skill=%s, image=%s",
                    hold_color, skill_level, image_path)

        ext = os.path.splitext(image_path)[1].lower()
        mime_type = _IMAGE_MIME_MAP.get(ext, "image/jpeg")
        image_file = self._genai.upload_file(path=image_path, mime_type=mime_type)

        try:
            wait = 0
            while image_file.state.name == "PROCESSING" and wait < 60:
                time.sleep(2)
                wait += 2
                image_file = self._genai.get_file(image_file.name)

            is_expert = skill_level == "expert"
            route_count = "1~2개" if is_expert else "2~3개"
            step_detail = (
                "각 스텝은 핵심 동작만 간결하게 작성하세요."
                if is_expert else
                "각 스텝은 구체적 동작과 무게중심/발 위치 등을 상세히 설명하세요."
            )

            prompt = f"""당신은 10년 경력의 전문 클라이밍 코치이자 루트세터입니다.

첨부된 클라이밍 벽 사진을 분석하세요.

사용자가 도전하려는 홀드 색상: **{hold_color}**
사용자 숙련도: {"숙련자" if is_expert else "초보자"}

[분석 규칙]
1. 사진에서 **{hold_color}** 색상의 홀드를 모두 식별하세요.
2. 식별한 홀드의 위치 관계를 파악하여 가능한 루트 {route_count}를 제안하세요.
3. 각 루트에 대해:
   - holds 배열에 각 홀드의 좌표를 작성 (xPct: 이미지 왼쪽에서 0~100%, yPct: 이미지 위쪽에서 0~100%)
   - 첫 번째 홀드는 label "시작", 마지막은 "탑", 나머지는 순번 ("2", "3" ...)
   - 시작 홀드부터 탑 홀드까지의 순서를 steps에 작성
   - {step_detail}
   - approachStrategy에 루트 공략 전략을 작성
   - keyTips에 핵심 팁 2~3개 작성
4. 루트 난이도를 V-스케일로 추정하세요.
5. 사진에서 관찰할 수 없는 내용은 추측하지 마세요.
6. holds의 좌표는 사진에서 실제 홀드가 보이는 위치를 정확히 반영하세요.

아래 JSON 형식으로만 응답하세요. 추가 텍스트 없이 JSON만 출력하세요.

{_ROUTE_SCHEMA}"""

            contents = [image_file, prompt]
            result, model_used = self._call(contents)
        finally:
            try:
                self._genai.delete_file(image_file.name)
            except Exception:
                pass

        result["holdColor"] = hold_color
        result["modelUsed"] = model_used
        return result

    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        skill_level = original_result.get("skillLevel", "beginner")
        attempt_result = original_result.get("attemptResult", "failure")
        is_expert = skill_level == "expert"
        is_success = attempt_result == "success"
        is_question = any(k in feedback_text for k in ["?", "？", "어떻게", "왜", "언제", "뭐", "무엇", "어디", "얼마나", "차이", "알려줘", "설명해"])

        schema = _SUCCESS_SCHEMA if is_success else _FAILURE_SCHEMA
        coaching_rule = (
            "coachingSuggestions는 정확히 2개, 4요소를 압축하여 재작성하세요."
            if is_expert else
            "coachingSuggestions는 정확히 4개(동작/루트/훈련/심리 각 1개씩), 피드백을 반영하여 상세히 재작성하세요."
        )
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
