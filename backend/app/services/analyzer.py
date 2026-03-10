import random
from abc import ABC, abstractmethod
from typing import Optional


class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, duration_seconds: float, memo: Optional[str] = None) -> dict:
        pass

    @abstractmethod
    def reanalyze(self, original_result: dict, feedback_text: str, revision: int) -> dict:
        pass


class MockAnalyzer(BaseAnalyzer):
    """
    Mock analyzer for MVP.
    Replace this class with a real AI analyzer (OpenAI, Claude, Gemini + vision model)
    by implementing the same BaseAnalyzer interface.
    """

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
                "체중 이동 전 발이 완전히 안착했는지 확인하세요.",
            ]
            result["revisedPoints"].append("footworkFeedback: 사용자 피드백(발) 반영하여 강화")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(2, 8))

        if "무게중심" in fb or "중심" in fb:
            result["centerOfMassFeedback"] = [
                "무게중심을 발 위로 더 직접적으로 이동시켜야 합니다.",
                "이동 전 무게중심을 의식적으로 지지발 위에 위치시키세요.",
                "골반을 벽에 가깝게 유지하면 무게중심 안정에 도움됩니다.",
            ]
            result["revisedPoints"].append("centerOfMassFeedback: 사용자 피드백(무게중심) 반영하여 강화")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(1, 6))

        if "손" in fb or "자세" in fb:
            result["postureFeedback"] = [
                "팔 각도를 90~120도로 유지하여 근육 효율을 높이세요.",
                "상체가 벽에서 멀어지지 않도록 코어를 긴장시키세요.",
                "손 홀드를 잡기 전 발 위치를 먼저 확인하세요.",
            ]
            result["revisedPoints"].append("postureFeedback: 사용자 피드백(손/자세) 반영하여 강화")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(1, 5))

        if "크럭스" in fb:
            result["failSegment"]["description"] = (
                result["failSegment"]["description"]
                + " 사용자 확인: 크럭스 구간에서 동작 전환 타이밍이 핵심입니다."
            )
            result["revisedPoints"].append("failSegment: 크럭스 구간 설명 보강")

        if not result["revisedPoints"]:
            result["revisedPoints"].append("전반적인 재분석 수행: 일부 피드백 세부 사항 조정")
            result["completionProbability"] = min(100, result["completionProbability"] + random.randint(1, 4))

        return result

    def _short_video_result(self, duration: float) -> dict:
        fail_start = max(0.0, duration * 0.5)
        fail_end = min(duration, fail_start + duration * 0.2)
        return {
            "summary": "영상 길이가 짧아 충분한 분석이 어렵습니다. 시도 자체는 좋았으나 데이터가 부족합니다.",
            "failReason": "분석 데이터 부족 (30초 미만)",
            "failSegment": {
                "startSec": round(fail_start, 1),
                "endSec": round(fail_end, 1),
                "description": "짧은 구간이지만 동작 전환 시 불안정이 관찰됩니다.",
            },
            "strategySuggestions": [
                "더 긴 시도 영상을 촬영하면 더 정확한 분석이 가능합니다.",
                "전체 루트를 포함한 영상을 제공해주세요.",
            ],
            "postureFeedback": ["영상이 짧아 자세 전체를 분석하기 어렵습니다."],
            "footworkFeedback": ["발 위치 데이터가 충분하지 않습니다."],
            "centerOfMassFeedback": ["무게중심 분석을 위해 더 긴 영상이 필요합니다."],
            "completionProbability": 45,
            "confidence": 0.42,
            "userFeedbackApplied": False,
            "revisedPoints": [],
        }

    def _beginner_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.6, 1)
        fail_end = round(duration * 0.75, 1)
        probability = random.randint(55, 70)
        return {
            "summary": "기본 자세는 갖춰져 있으나 홀드 전환 시 체중 이동이 늦어 실패했습니다.",
            "failReason": "홀드 전환 타이밍에서 체중 이동 지연",
            "failSegment": {
                "startSec": fail_start,
                "endSec": fail_end,
                "description": "중반부 홀드 전환 구간에서 팔에 의존하는 경향이 관찰됩니다.",
            },
            "strategySuggestions": [
                "발을 먼저 올린 뒤 손을 보내는 순서를 의식적으로 연습해보세요.",
                "팔을 당기기보다 발로 밀어올리는 느낌으로 등반해보세요.",
            ],
            "postureFeedback": [
                "상체가 벽에서 너무 빨리 멀어집니다.",
                "팔꿈치가 과도하게 펴지는 경향이 있습니다.",
            ],
            "footworkFeedback": [
                "발 홀드를 밟기 전 시각적으로 확인하는 습관을 들이세요.",
                "발끝(토우)으로 정확히 밟는 연습이 필요합니다.",
            ],
            "centerOfMassFeedback": [
                "무게중심이 항상 지지발 위에 있도록 의식하세요.",
                "이동 중 무게중심이 흔들리는 구간이 관찰됩니다.",
            ],
            "completionProbability": probability,
            "confidence": 0.72,
            "userFeedbackApplied": False,
            "revisedPoints": [],
        }

    def _intermediate_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.55, 1)
        fail_end = round(duration * 0.70, 1)
        probability = random.randint(60, 78)
        return {
            "summary": "왼손 홀드 전환 이후 체중 이동이 늦어 실패했습니다. 크럭스 구간 접근 전략을 수정하면 완등 가능성이 높아집니다.",
            "failReason": "크럭스 구간 체중 중심 이동 부족",
            "failSegment": {
                "startSec": fail_start,
                "endSec": fail_end,
                "description": "크럭스 진입 후 오른발 지지가 무너지며 상체 의존도가 급격히 높아지는 구간",
            },
            "strategySuggestions": [
                "오른발을 먼저 더 높게 올린 뒤 왼손을 보내세요.",
                "왼팔로 당기기보다 골반을 벽에 붙이며 체중을 실으세요.",
            ],
            "postureFeedback": [
                "상체가 벽에서 너무 빨리 멀어집니다.",
                "어깨 위치를 낮게 유지하면 팔 힘을 절약할 수 있습니다.",
            ],
            "footworkFeedback": [
                "오른발 토우 포지션이 불안정합니다.",
                "발 홀드 선택 시 더 높은 위치를 활용해보세요.",
            ],
            "centerOfMassFeedback": [
                "무게중심이 오른발 위에 충분히 실리지 않았습니다.",
                "크럭스 직전 무게중심을 의식적으로 낮추세요.",
            ],
            "completionProbability": probability,
            "confidence": 0.78,
            "userFeedbackApplied": False,
            "revisedPoints": [],
        }

    def _advanced_result(self, duration: float) -> dict:
        fail_start = round(duration * 0.70, 1)
        fail_end = round(duration * 0.85, 1)
        probability = random.randint(58, 75)
        return {
            "summary": "후반부 체력 저하로 인해 동작 정확도가 떨어지며 실패했습니다. 루트 전반의 에너지 분배 전략 재검토가 필요합니다.",
            "failReason": "후반 체력 저하 및 동작 정확도 감소",
            "failSegment": {
                "startSec": fail_start,
                "endSec": fail_end,
                "description": "후반부 연속 홀드 구간에서 발 정확도가 저하되고 팔 의존도가 급격히 증가하는 구간",
            },
            "strategySuggestions": [
                "전반부 쉬운 구간에서 의도적으로 레스팅 포지션을 찾아 체력을 분배하세요.",
                "후반 크럭스를 위해 중반부의 불필요한 동작을 최소화하는 루트 리딩이 필요합니다.",
            ],
            "postureFeedback": [
                "후반부로 갈수록 상체가 앞으로 쏠리는 경향이 있습니다.",
                "피로 시 팔을 더 굽히려는 경향이 관찰됩니다. 플래깅을 활용하세요.",
            ],
            "footworkFeedback": [
                "후반부 발 위치 정확도가 전반 대비 크게 감소했습니다.",
                "피로 시 발 홀드를 여러 번 재조정하는 패턴이 관찰됩니다.",
            ],
            "centerOfMassFeedback": [
                "후반부 무게중심 이동 궤적이 불안정해집니다.",
                "체력 저하 시 무게중심을 낮게 유지하는 의식적 노력이 필요합니다.",
            ],
            "completionProbability": probability,
            "confidence": 0.82,
            "userFeedbackApplied": False,
            "revisedPoints": [],
        }


# Factory function — swap MockAnalyzer with real AI analyzer here
def get_analyzer() -> BaseAnalyzer:
    return MockAnalyzer()
