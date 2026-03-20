from pydantic import BaseModel
from typing import Optional, List


class HoldPosition(BaseModel):
    xPct: float
    yPct: float
    label: str


class RouteSuggestion(BaseModel):
    name: str
    difficulty: str
    description: str
    holds: Optional[List[HoldPosition]] = None
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
    routeImageUrl: Optional[str] = None
