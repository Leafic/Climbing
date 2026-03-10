import json
import logging
import os
import re
import random
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, duration_seconds: float, memo: Optional[str] = None) -> dict:
        pass

    @abstractmethod
    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        pass


# ─────────────────────────────────────────
# Google Gemini Analyzer
# ─────────────────────────────────────────

_RESULT_SCHEMA = """{
  "summary": "전체 시도 요약 (2~3문장)",
  "failReason": "실패 핵심 원인 (한 문장)",
  "failSegment": {
    "startSec": <실패 구간 시작 초 (숫자)>,
    "endSec": <실패 구간 종료 초 (숫자)>,
    "description": "해당 구간 상세 설명"
  },
  "strategySuggestions": ["전략 제안 1", "전략 제안 2"],
  "postureFeedback": ["자세 피드백 1", "자세 피드백 2"],
  "footworkFeedback": ["발 피드백 1", "발 피드백 2"],
  "centerOfMassFeedback": ["무게중심 피드백 1", "무게중심 피드백 2"],
  "completionProbability": <완등 가능성 0~100 정수>,
  "confidence": <분석 신뢰도 0.0~1.0>,
  "userFeedbackApplied": false,
  "revisedPoints": []
}"""


def _extract_json(text: str) -> dict:
    """LLM 응답에서 JSON 블록을 추출하여 파싱"""
    # ```json ... ``` 블록 우선 추출
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    # 중괄호 블록 직접 추출
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"JSON을 찾을 수 없습니다. 응답: {text[:300]}")


_PRIMARY_MODEL = "gemini-3.1-flash-lite-preview"
_FALLBACK_MODEL = "gemini-2.5-flash"


class GeminiAnalyzer(BaseAnalyzer):
    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai

    def _call_with_fallback(self, prompt: str) -> dict:
        """Primary 모델 호출 실패 시 Fallback 모델로 재시도"""
        for model_name in (_PRIMARY_MODEL, _FALLBACK_MODEL):
            try:
                logger.info("[Gemini] 모델 호출: %s", model_name)
                model = self._genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                result = _extract_json(response.text)
                logger.info("[Gemini] 응답 수신 완료 (model=%s)", model_name)
                return result
            except Exception as e:
                logger.warning("[Gemini] %s 실패: %s — 다음 모델로 시도", model_name, e)
        raise RuntimeError("모든 Gemini 모델 호출에 실패했습니다.")

    def analyze(self, duration_seconds: float, memo: Optional[str] = None) -> dict:
        logger.info("[Gemini] analyze() 호출 — duration=%.1fs", duration_seconds)
        memo_text = f"\n사용자 메모: {memo}" if memo else ""
        prompt = f"""당신은 클라이밍 코치입니다. 클라이밍 시도 영상 메타데이터를 바탕으로 실패 원인을 분석하고 개선 전략을 제안합니다.

영상 길이: {duration_seconds:.1f}초{memo_text}

아래 JSON 형식으로만 응답하세요. 추가 텍스트 없이 JSON만 출력하세요.

{_RESULT_SCHEMA}"""
        return self._call_with_fallback(prompt)

    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        prompt = f"""당신은 클라이밍 코치입니다. 이전 분석 결과에 사용자 피드백을 반영하여 재분석합니다.

이전 분석 결과:
{json.dumps(original_result, ensure_ascii=False, indent=2)}

사용자 피드백 (revision {revision}):
{feedback_text}

피드백을 반영하여 개선된 분석 결과를 아래 JSON 형식으로만 응답하세요.
- "userFeedbackApplied"는 반드시 true로 설정하세요.
- "revisedPoints"에 이번에 변경된 항목을 간략히 나열하세요.
- 추가 텍스트 없이 JSON만 출력하세요.

{_RESULT_SCHEMA}"""
        result = self._call_with_fallback(prompt)
        result["userFeedbackApplied"] = True
        return result


# ─────────────────────────────────────────
# Mock Analyzer (Gemini 키 없을 때 fallback)
# ─────────────────────────────────────────

class MockAnalyzer(BaseAnalyzer):
    def analyze(self, duration_seconds: float, memo: Optional[str] = None) -> dict:
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
