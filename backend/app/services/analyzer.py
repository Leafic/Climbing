import json
import logging
import os
import re
import random
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
  "successProbabilityBreakdown": {
    "base": 20,
    "centerOfMass": {
      "score": <0~30 정수>,
      "reason": "무게중심/코어 안정성 평가 근거"
    },
    "holdControl": {
      "score": <0~30 정수>,
      "reason": "홀드 제어 및 타이밍 평가 근거"
    },
    "energyAndMental": {
      "score": <0~20 정수>,
      "reason": "체력 안배 및 심리 루틴 평가 근거"
    },
    "total": <base + 세 지표 합산, 최대 100>
  },
  "coachingSuggestions": ["코칭 제안 (숙련도에 따라 2개 또는 4개)"],
  "postureFeedback": ["자세 피드백 1", "자세 피드백 2"],
  "footworkFeedback": ["발 피드백 1", "발 피드백 2"],
  "centerOfMassFeedback": ["무게중심 피드백 1", "무게중심 피드백 2"],
  "completionProbability": <successProbabilityBreakdown.total 과 동일한 값. '다음 시도 성공 확률'>,
  "confidence": <분석 신뢰도 0.0~1.0>,
  "userFeedbackApplied": false,
  "revisedPoints": [],
  "questionAnswer": null
}"""

_SUCCESS_SCHEMA = """{
  "summary": "전체 시도 요약 — 완등 성공을 축하하며 잘된 점 중심으로 (2~3문장)",
  "attemptResult": "success",
  "skillLevel": "beginner 또는 expert",
  "failReason": null,
  "failSegment": null,
  "successHighlights": ["잘된 점 1 (구체적 동작/기술)", "잘된 점 2", "잘된 점 3"],
  "successProbabilityBreakdown": {
    "base": 20,
    "centerOfMass": {
      "score": <0~30 정수. 이번 성공에서 무게중심/코어가 얼마나 잘 활용됐는지>,
      "reason": "성공 요인 평가 근거"
    },
    "holdControl": {
      "score": <0~30 정수. 홀드 제어 및 타이밍 완성도>,
      "reason": "성공 요인 평가 근거"
    },
    "energyAndMental": {
      "score": <0~20 정수. 체력 안배 및 심리 루틴 완성도>,
      "reason": "성공 요인 평가 근거"
    },
    "total": <base + 세 지표 합산. 이번 시도의 '기술 완성도 점수'(최대 100)>
  },
  "coachingSuggestions": ["더 높은 난이도나 더 깔끔한 등반을 위한 개선 방향 (숙련도에 따라 2개 또는 4개)"],
  "postureFeedback": ["자세 개선 포인트 또는 잘된 점"],
  "footworkFeedback": ["발 위치 개선 포인트 또는 잘된 점"],
  "centerOfMassFeedback": ["무게중심 개선 포인트 또는 잘된 점"],
  "completionProbability": <successProbabilityBreakdown.total 과 동일한 값. '기술 완성도 점수'>,
  "confidence": <분석 신뢰도 0.0~1.0>,
  "userFeedbackApplied": false,
  "revisedPoints": [],
  "questionAnswer": null
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

[점수 산출 규칙 - 필수]
기본 20점에서 시작하여 3가지 지표로 합산합니다.
1. 무게중심/코어 안정성 (+0~30): 골반 밀착, 무게중심이 발 위에 있는지 여부
2. 홀드 제어 및 타이밍 (+0~30): 데드포인트 타이밍, 그립·풋워크 정확도
3. 체력 안배 및 심리 루틴 (+0~20): 펌핑 관리, 시선 처리, 호흡 안정성
completionProbability는 반드시 base(20) + 세 지표 합산값과 동일해야 합니다.
{"failSegment의 startSec/endSec은 영상에서 실제로 관찰된 실패 구간의 타임스탬프를 초 단위로 작성하세요." if has_video and not is_success else ""}

[코칭 제안 규칙 - 필수]
{coaching_rule}

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
- successProbabilityBreakdown을 피드백 내용 반영하여 재산출하세요. completionProbability는 합산값과 동일해야 합니다.
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
# Mock Analyzer (Gemini 키 없을 때 fallback)
# ─────────────────────────────────────────

class MockAnalyzer(BaseAnalyzer):
    def analyze(self, duration_seconds: float, video_path: Optional[str] = None,
                memo: Optional[str] = None, skill_level: str = "beginner",
                attempt_result: str = "failure") -> dict:
        if duration_seconds < 30:
            return self._short_video_result(duration_seconds)
        elif duration_seconds <= 60:
            return self._beginner_result(duration_seconds)
        elif duration_seconds <= 120:
            return self._intermediate_result(duration_seconds)
        else:
            return self._advanced_result(duration_seconds)

    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        import copy
        result = copy.deepcopy(original_result)
        result["userFeedbackApplied"] = True
        result["revisedPoints"] = list(result.get("revisedPoints", []))
        fb = feedback_text.lower()
        if "발" in fb:
            result["footworkFeedback"] = [
                "발 위치 개선이 핵심입니다. 토우를 홀드 중앙에 정확히 위치시키세요.",
                "발을 올리기 전 홀드를 눈으로 확인하는 습관을 들이세요.",
            ]
            result["revisedPoints"].append("footworkFeedback: 발 피드백 강화")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(2, 8))
        if "무게중심" in fb or "중심" in fb:
            result["centerOfMassFeedback"] = [
                "무게중심을 발 위로 더 직접적으로 이동시켜야 합니다.",
                "골반을 벽에 가깝게 유지하면 무게중심 안정에 도움됩니다.",
            ]
            result["revisedPoints"].append("centerOfMassFeedback: 무게중심 피드백 강화")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(1, 6))
        if not result["revisedPoints"]:
            result["revisedPoints"].append("전반적인 재분석 수행")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(1, 4))
        return result

    def _short_video_result(self, duration: float) -> dict:
        fail_start = max(0.0, duration * 0.5)
        return {
            "summary": "영상 길이가 짧아 충분한 분석이 어렵습니다.",
            "failReason": "분석 데이터 부족 (30초 미만)",
            "failSegment": {"startSec": round(fail_start, 1), "endSec": round(min(duration, fail_start + duration * 0.2), 1), "description": "짧은 구간이지만 동작 전환 시 불안정이 관찰됩니다."},
            "strategySuggestions": ["더 긴 시도 영상을 촬영하면 더 정확한 분석이 가능합니다."],
            "postureFeedback": ["영상이 짧아 자세 전체를 분석하기 어렵습니다."],
            "footworkFeedback": ["발 위치 데이터가 충분하지 않습니다."],
            "centerOfMassFeedback": ["무게중심 분석을 위해 더 긴 영상이 필요합니다."],
            "completionProbability": 45, "confidence": 0.42,
            "userFeedbackApplied": False, "revisedPoints": [],
        }

    def _beginner_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.6, 1)
        return {
            "summary": "기본 자세는 갖춰져 있으나 홀드 전환 시 체중 이동이 늦어 실패했습니다.",
            "failReason": "홀드 전환 타이밍에서 체중 이동 지연",
            "failSegment": {"startSec": fail_start, "endSec": round(duration * 0.75, 1), "description": "중반부 홀드 전환 구간에서 팔에 의존하는 경향이 관찰됩니다."},
            "strategySuggestions": ["발을 먼저 올린 뒤 손을 보내는 순서를 의식적으로 연습해보세요.", "팔을 당기기보다 발로 밀어올리는 느낌으로 등반해보세요."],
            "postureFeedback": ["상체가 벽에서 너무 빨리 멀어집니다.", "팔꿈치가 과도하게 펴지는 경향이 있습니다."],
            "footworkFeedback": ["발 홀드를 밟기 전 시각적으로 확인하는 습관을 들이세요.", "발끝(토우)으로 정확히 밟는 연습이 필요합니다."],
            "centerOfMassFeedback": ["무게중심이 항상 지지발 위에 있도록 의식하세요."],
            "completionProbability": random.randint(55, 70), "confidence": 0.72,
            "userFeedbackApplied": False, "revisedPoints": [],
        }

    def _intermediate_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.55, 1)
        return {
            "summary": "왼손 홀드 전환 이후 체중 이동이 늦어 실패했습니다. 크럭스 구간 접근 전략을 수정하면 완등 가능성이 높아집니다.",
            "failReason": "크럭스 구간 체중 중심 이동 부족",
            "failSegment": {"startSec": fail_start, "endSec": round(duration * 0.70, 1), "description": "크럭스 진입 후 오른발 지지가 무너지며 상체 의존도가 급격히 높아지는 구간"},
            "strategySuggestions": ["오른발을 먼저 더 높게 올린 뒤 왼손을 보내세요.", "왼팔로 당기기보다 골반을 벽에 붙이며 체중을 실으세요."],
            "postureFeedback": ["상체가 벽에서 너무 빨리 멀어집니다.", "어깨 위치를 낮게 유지하면 팔 힘을 절약할 수 있습니다."],
            "footworkFeedback": ["오른발 토우 포지션이 불안정합니다.", "발 홀드 선택 시 더 높은 위치를 활용해보세요."],
            "centerOfMassFeedback": ["무게중심이 오른발 위에 충분히 실리지 않았습니다.", "크럭스 직전 무게중심을 의식적으로 낮추세요."],
            "completionProbability": random.randint(60, 78), "confidence": 0.78,
            "userFeedbackApplied": False, "revisedPoints": [],
        }

    def _advanced_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.70, 1)
        return {
            "summary": "후반부 체력 저하로 인해 동작 정확도가 떨어지며 실패했습니다. 루트 전반의 에너지 분배 전략 재검토가 필요합니다.",
            "failReason": "후반 체력 저하 및 동작 정확도 감소",
            "failSegment": {"startSec": fail_start, "endSec": round(duration * 0.85, 1), "description": "후반부 연속 홀드 구간에서 발 정확도가 저하되고 팔 의존도가 급격히 증가하는 구간"},
            "strategySuggestions": ["전반부 쉬운 구간에서 의도적으로 레스팅 포지션을 찾아 체력을 분배하세요.", "후반 크럭스를 위해 중반부의 불필요한 동작을 최소화하세요."],
            "postureFeedback": ["후반부로 갈수록 상체가 앞으로 쏠리는 경향이 있습니다."],
            "footworkFeedback": ["후반부 발 위치 정확도가 전반 대비 크게 감소했습니다."],
            "centerOfMassFeedback": ["후반부 무게중심 이동 궤적이 불안정해집니다."],
            "completionProbability": random.randint(58, 75), "confidence": 0.82,
            "userFeedbackApplied": False, "revisedPoints": [],
        }


# ─────────────────────────────────────────
# Factory — GOOGLE_API_KEY 있으면 Gemini, 없으면 Mock
# ─────────────────────────────────────────

def get_analyzer() -> BaseAnalyzer:
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        logger.info("[Analyzer] GeminiAnalyzer 사용")
        return GeminiAnalyzer(api_key=api_key)
    logger.warning("[Analyzer] GOOGLE_API_KEY 없음 → MockAnalyzer fallback")
    return MockAnalyzer()
