from pydantic import BaseModel
from typing import Optional, List


class RouteStep(BaseModel):
    order: int
    instruction: str


class RouteSuggestion(BaseModel):
    name: str
    difficulty: str
    description: str
    steps: List[str]
    approachStrategy: str
    keyTips: List[str]


class RouteAnalysisResultJSON(BaseModel):
    wallDescription: str
    holdColor: str
    identifiedHolds: int
    routes: List[RouteSuggestion]
    generalAdvice: str
    confidence: float
    modelUsed: Optional[str] = None
