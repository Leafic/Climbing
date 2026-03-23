"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { RouteAnalysisResult, RouteSuggestion, HoldPosition } from "@/lib/api";

interface Props {
  result: RouteAnalysisResult;
}

/* 홀드 좌표를 퍼센트(%)로 변환 — 픽셀 좌표 우선, 없으면 기존 퍼센트 사용 */
function holdToPercent(hold: HoldPosition, imgW?: number, imgH?: number): { xPct: number; yPct: number } {
  if (hold.xPx != null && hold.yPx != null && imgW && imgH) {
    return {
      xPct: (hold.xPx / imgW) * 100,
      yPct: (hold.yPx / imgH) * 100,
    };
  }
  return {
    xPct: hold.xPct ?? 0,
    yPct: hold.yPct ?? 0,
  };
}

/* 이미지 naturalWidth/Height를 읽는 훅 */
function useImageNaturalSize(src: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  return size;
}

/* ── 루트 색상 (백엔드와 동일) ── */
const ROUTE_COLORS = [
  { main: "#FF3C3C", light: "rgba(255,60,60,0.15)", text: "text-red-500" },
  { main: "#3CB4FF", light: "rgba(60,180,255,0.15)", text: "text-blue-500" },
  { main: "#3CDC50", light: "rgba(60,220,80,0.15)", text: "text-green-500" },
  { main: "#FFC828", light: "rgba(255,200,40,0.15)", text: "text-yellow-500" },
  { main: "#C864FF", light: "rgba(200,100,255,0.15)", text: "text-purple-500" },
];

/* ── 풀스크린 이미지 모달 (마커 포함) ── */
function ImageModal({
  src,
  holds,
  routeColor,
  activeStepIdx,
  imgW,
  imgH,
  onClose,
}: {
  src: string;
  holds: HoldPosition[];
  routeColor: typeof ROUTE_COLORS[0];
  activeStepIdx: number | null;
  imgW?: number;
  imgH?: number;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgRect, setImgRect] = useState<{ w: number; h: number; natW: number; natH: number } | null>(null);

  const handleImgLoad = useCallback(() => {
    if (imgRef.current) {
      setImgRect({
        w: imgRef.current.clientWidth,
        h: imgRef.current.clientHeight,
        natW: imgRef.current.naturalWidth,
        natH: imgRef.current.naturalHeight,
      });
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={src}
          alt="루트 경로 확대"
          className="max-w-[95vw] max-h-[90vh] object-contain block"
          onLoad={handleImgLoad}
        />
        {/* 마커를 이미지 실제 렌더 영역 위에 정확히 배치 */}
        {imgRect && holds.map((hold, i) => {
          const natW = imgRect.natW || imgW || 1;
          const natH = imgRect.natH || imgH || 1;
          const pct = holdToPercent(hold, natW, natH);
          const isStart = hold.label.startsWith("시작");
          const isEnd = hold.label === "탑";
          const bgColor = isStart ? "#006c49" : isEnd ? "#632ecd" : routeColor.main;
          const isActive = activeStepIdx === i;
          const size = isActive ? 48 : 36;
          const handIcon = hold.hand === "left" ? "L" : hold.hand === "right" ? "R" : "";
          const displayLabel = isStart ? (handIcon || hold.label.replace("시작", "S"))
            : hold.label.length > 2 ? hold.label.slice(0, 1) : hold.label;
          return (
            <div
              key={`modal-hold-${i}`}
              className="absolute"
              style={{
                left: `${pct.xPct}%`,
                top: `${pct.yPct}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
            >
              <div
                className="flex items-center justify-center rounded-full text-white font-black"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: bgColor,
                  fontSize: isActive ? "14px" : "11px",
                  border: "3px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                }}
              >
                {displayLabel}
              </div>
            </div>
          );
        })}
      </div>
      <p className="absolute bottom-6 text-white/60 text-xs">배지와의 점이 매칭 이를 연습에 적용합니다</p>
    </div>
  );
}

/* ── 인터랙티브 이미지 오버레이 ── */
function RouteImageOverlay({
  imageUrl,
  routes,
  activeStepIdx,
  activeRouteIdx,
  onStepTap,
  onFullscreen,
  imgW,
  imgH,
}: {
  imageUrl: string;
  routes: RouteSuggestion[];
  activeStepIdx: number | null;
  activeRouteIdx: number;
  onStepTap: (stepIdx: number) => void;
  onFullscreen: () => void;
  imgW?: number;
  imgH?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const route = routes[activeRouteIdx];
  const holds = route?.holds || [];
  const color = ROUTE_COLORS[activeRouteIdx % ROUTE_COLORS.length];

  // 이미지 원본 크기 읽기
  const naturalW = imgRef.current?.naturalWidth || imgW || 1;
  const naturalH = imgRef.current?.naturalHeight || imgH || 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ overflow: "visible" }}
    >
      <img
        ref={imgRef}
        className="w-full h-auto rounded-2xl cursor-pointer"
        src={imageUrl}
        alt="클라이밍 벽"
        onClick={onFullscreen}
        onLoad={() => setImgLoaded(true)}
      />
      {/* 오버레이 컨테이너 — 이미지와 동일 크기 */}
      {imgLoaded && (
        <div className="absolute inset-0" style={{ zIndex: 15 }}>
          {/* 경로 연결선 — SVG, 이미지 비율에 맞는 viewBox */}
          {holds.length >= 2 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${naturalW} ${naturalH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {holds.map((hold, i) => {
                if (i === holds.length - 1) return null;
                const p1 = hold.xPx != null ? { x: hold.xPx, y: hold.yPx! } : { x: ((hold.xPct ?? 0) / 100) * naturalW, y: ((hold.yPct ?? 0) / 100) * naturalH };
                const p2 = holds[i+1].xPx != null ? { x: holds[i+1].xPx, y: holds[i+1].yPx! } : { x: ((holds[i+1].xPct ?? 0) / 100) * naturalW, y: ((holds[i+1].yPct ?? 0) / 100) * naturalH };
                const sw = Math.max(naturalW, naturalH) * 0.004;
                return (
                  <line
                    key={`line-${i}`}
                    x1={p1.x} y1={p1.y}
                    x2={p2.x} y2={p2.y}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={sw}
                    strokeDasharray={`${sw * 3} ${sw * 2}`}
                  />
                );
              })}
            </svg>
          )}
          {/* 홀드 마커 — 퍼센트 위치 */}
          {holds.map((hold, i) => {
            const pct = holdToPercent(hold, naturalW, naturalH);
            const isActive = activeStepIdx === i;
            const isStart = hold.label.startsWith("시작");
            const isEnd = hold.label === "탑";
            const bgColor = isStart ? "#006c49" : isEnd ? "#632ecd" : color.main;
            const size = isActive ? 44 : 34;
            const fontSize = isActive ? 13 : 11;
            const handIcon = hold.hand === "left" ? "L" : hold.hand === "right" ? "R" : "";
            const displayLabel = isStart ? (handIcon || hold.label.replace("시작", "S"))
              : hold.label.length > 2 ? hold.label.slice(0, 1) : hold.label;

            return (
              <div
                key={`hold-${i}`}
                style={{
                  position: "absolute",
                  left: `${pct.xPct}%`,
                  top: `${pct.yPct}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isActive ? 25 : 20,
                  pointerEvents: "auto",
                }}
                onClick={(e) => { e.stopPropagation(); onStepTap(i); }}
              >
                {isActive && (
                  <div
                    className="absolute rounded-full animate-ping"
                    style={{
                      width: `${size + 20}px`,
                      height: `${size + 20}px`,
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      backgroundColor: bgColor,
                      opacity: 0.3,
                    }}
                  />
                )}
                <div
                  className="flex items-center justify-center rounded-full text-white font-black cursor-pointer"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: bgColor,
                    fontSize: `${fontSize}px`,
                    border: "3px solid rgba(255,255,255,0.95)",
                    boxShadow: isActive
                  ? `0 0 0 5px ${bgColor}55, 0 4px 16px rgba(0,0,0,0.4)`
                  : "0 2px 10px rgba(0,0,0,0.35)",
                transition: "all 0.3s ease",
              }}
            >
              {displayLabel}
            </div>
          </div>
        );
          })}
        </div>
      )}
      {/* 확대 힌트 */}
      <div
        className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-bold cursor-pointer"
        style={{ zIndex: 30 }}
        onClick={onFullscreen}
      >
        <span className="material-symbols-outlined text-[14px]">zoom_in</span>
        확대
      </div>
    </div>
  );
}

/* ── 스텝 텍스트에서 [라벨] 파싱 ── */
function parseStepLabel(step: string): { label: string | null; text: string } {
  // "[시작] ...", "[2번] ...", "[탑] ..." 형식 파싱
  const cleaned = step.replace(/^\d+\.\s*/, "");
  const match = cleaned.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
  if (match) return { label: match[1], text: match[2] };
  return { label: null, text: step.replace(/^\d+\.\s*/, "") };
}

/* ── 라벨로 hold 인덱스 찾기 ── */
function findHoldIdxByLabel(
  label: string,
  holds?: HoldPosition[]
): number | null {
  if (!holds || !label) return null;
  const normalized = label.replace(/번$/, "");
  const idx = holds.findIndex(h => {
    const hNorm = h.label.replace(/번$/, "");
    return hNorm === normalized || h.label === label;
  });
  return idx >= 0 ? idx : null;
}

/* ── 무브 가이드 (전체 표시, 홀드 라벨 매칭) ── */
function MoveGuide({
  steps,
  holds,
  activeStepIdx,
  onStepTap,
  routeColor,
}: {
  steps: string[];
  holds?: HoldPosition[];
  activeStepIdx: number | null;
  onStepTap: (holdIdx: number) => void;
  routeColor: typeof ROUTE_COLORS[0];
}) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const { label: stepLabel, text: stepText } = parseStepLabel(step);
        const holdIdx = stepLabel ? findHoldIdxByLabel(stepLabel, holds) : i < (holds?.length || 0) ? i : null;
        const hold = holdIdx !== null && holds ? holds[holdIdx] : null;
        const isActive = holdIdx !== null && activeStepIdx === holdIdx;

        const isFirst = i === 0;
        const isLast = i === steps.length - 1;

        const dotBg = isFirst
          ? "bg-secondary"
          : isLast
            ? "bg-tertiary"
            : "";
        const dotStyle = !isFirst && !isLast
          ? { backgroundColor: routeColor.main }
          : {};
        const icon = isFirst ? "play_arrow" : isLast ? "flag" : "";

        const displayLabel = hold
          ? hold.label
          : stepLabel || `${i + 1}`;

        return (
          <div
            key={i}
            onClick={() => { if (holdIdx !== null) onStepTap(holdIdx); }}
            className={`flex gap-4 group cursor-pointer rounded-xl px-2 py-1.5 -mx-2 transition-colors ${
              isActive ? "bg-surface-container-low" : "hover:bg-surface-container-low/50"
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full ${dotBg} text-white flex items-center justify-center z-10 shrink-0 transition-all duration-300 ${
                  isActive ? "scale-125 ring-4 ring-primary/20" : ""
                }`}
                style={{
                  ...dotStyle,
                  border: "2.5px solid rgba(255,255,255,0.8)",
                  boxShadow: isActive ? "0 0 12px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.15)",
                }}
              >
                {icon ? (
                  <span className="material-symbols-outlined text-sm" style={
                    { fontVariationSettings: "'FILL' 1" }
                  }>{icon}</span>
                ) : (
                  <span className="text-[10px] font-black">{displayLabel.length > 2 ? displayLabel.slice(0, 1) : displayLabel}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="w-0.5 h-10 bg-surface-container-highest" />
              )}
            </div>
            <div className="pt-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                  style={{
                    backgroundColor: isFirst ? "#006c49" : isLast ? "#632ecd" : routeColor.main,
                  }}
                >
                  {displayLabel}
                </span>
                {hold && holdIdx !== null && (
                  <span className="text-[9px] text-on-surface-variant">
                    이미지 마커 #{holdIdx + 1}
                  </span>
                )}
              </div>
              <p className={`text-sm leading-relaxed ${
                isActive ? "text-on-surface font-medium" : "text-on-surface-variant"
              }`}>
                {stepText}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 추가 루트 카드 (아코디언, 선택 시 이미지 마커 전환) ── */
function CompactRouteCard({
  route, index, routeColor, isSelected, onSelect, activeStepIdx, onStepTap,
}: {
  route: RouteSuggestion;
  index: number;
  routeColor: typeof ROUTE_COLORS[0];
  isSelected: boolean;
  onSelect: () => void;
  activeStepIdx: number | null;
  onStepTap: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) onSelect();
  };

  return (
    <div className={`bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden transition-all ${
      isSelected ? "ring-2" : ""
    }`} style={isSelected ? { "--tw-ring-color": routeColor.main } as React.CSSProperties : {}}>
      <button
        onClick={handleToggle}
        className="w-full px-5 py-4 flex items-center justify-between active:bg-surface-container-low transition-colors"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-white text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: routeColor.main }}
          >
            루트 {index + 1}
          </span>
          <h3 className="font-bold text-on-surface text-sm">{route.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-surface-container-high text-on-surface-variant text-xs font-bold px-2.5 py-1 rounded-full">
            {route.difficulty}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            {open ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4">
          <p className="text-sm text-on-surface-variant leading-relaxed">{route.description}</p>
          <div className="bg-secondary-container/10 border-l-4 border-secondary-container p-3 rounded-xl">
            <p className="text-sm text-on-surface leading-relaxed">{route.approachStrategy}</p>
          </div>
          <MoveGuide
            steps={route.steps}
            holds={route.holds}
            activeStepIdx={activeStepIdx}
            onStepTap={onStepTap}
            routeColor={routeColor}
          />
        </div>
      )}
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function RouteResultCard({ result }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(true);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);

  const currentRoute = result.routes[activeRouteIdx] || result.routes[0];
  const mainRoute = result.routes[0];
  const additionalRoutes = result.routes.slice(1);
  const currentColor = ROUTE_COLORS[activeRouteIdx % ROUTE_COLORS.length];

  const handleStepTap = (idx: number) => {
    setActiveStepIdx(activeStepIdx === idx ? null : idx);
  };

  const handleRouteSwitch = (routeIdx: number) => {
    setActiveRouteIdx(routeIdx);
    setActiveStepIdx(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 풀스크린 모달 — 원본 이미지 + 선택된 루트 마커만 */}
      {showModal && (result.originalImageUrl || result.routeImageUrl) && (
        <ImageModal
          src={result.originalImageUrl || result.routeImageUrl!}
          holds={currentRoute?.holds || []}
          routeColor={currentColor}
          activeStepIdx={activeStepIdx}
          imgW={result.imageWidth}
          imgH={result.imageHeight}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* 벽 이미지 — 원본 이미지 + 선택된 루트 마커만 오버레이 */}
      {(result.originalImageUrl || result.routeImageUrl) && (
        <RouteImageOverlay
          imageUrl={result.originalImageUrl || result.routeImageUrl!}
          routes={result.routes}
          activeStepIdx={activeStepIdx}
          activeRouteIdx={activeRouteIdx}
          onStepTap={handleStepTap}
          onFullscreen={() => setShowModal(true)}
          imgW={result.imageWidth}
          imgH={result.imageHeight}
        />
      )}

      {/* 메인 분석 카드 */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient">
        {/* 루트 선택 탭 */}
        {result.routes.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {result.routes.map((route, i) => {
              const rc = ROUTE_COLORS[i % ROUTE_COLORS.length];
              const isSelected = activeRouteIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => handleRouteSwitch(i)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isSelected ? "text-white scale-105" : "text-on-surface-variant bg-surface-container-low"
                  }`}
                  style={isSelected ? { backgroundColor: rc.main } : {}}
                >
                  루트 {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* 뱃지 */}
        <div className="flex items-center justify-between mb-3">
          <span className="bg-secondary-container/20 text-on-secondary-container text-xs font-bold px-3 py-1 rounded-full">
            분석된 루트
          </span>
          {currentRoute && (
            <span className="text-white font-headline font-extrabold px-3 py-1 rounded-lg text-sm"
              style={{ backgroundColor: currentColor.main }}>
              {currentRoute.difficulty}
            </span>
          )}
        </div>

        {/* 제목 */}
        <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-4">
          {currentRoute?.name || "루트 분석 결과"}
        </h2>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-surface-container-low p-3 rounded-2xl text-center">
            <span className="block text-outline text-[10px] font-bold uppercase tracking-wider mb-1">Hold Count</span>
            <span className="font-headline font-bold text-lg">{result.identifiedHolds}</span>
          </div>
          <div className="bg-surface-container-low p-3 rounded-2xl text-center">
            <span className="block text-outline text-[10px] font-bold uppercase tracking-wider mb-1">Color</span>
            <span className="font-headline font-bold text-lg">{result.holdColor}</span>
          </div>
          <div className="bg-surface-container-low p-3 rounded-2xl text-center">
            <span className="block text-outline text-[10px] font-bold uppercase tracking-wider mb-1">Confidence</span>
            <span className="font-headline font-bold text-lg text-secondary">{result.confidence}%</span>
          </div>
        </div>

        {/* AI 공략 전략 — 아코디언 */}
        {currentRoute && (
          <div className="rounded-xl mb-6 overflow-hidden" style={{ backgroundColor: `${currentColor.main}10`, borderLeft: `4px solid ${currentColor.main}` }}>
            <button
              onClick={() => setStrategyOpen(!strategyOpen)}
              className="w-full p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: currentColor.main }}>psychology</span>
                <h3 className="font-bold text-on-surface">AI 공략 전략</h3>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                {strategyOpen ? "expand_less" : "expand_more"}
              </span>
            </button>
            {strategyOpen && (
              <div className="px-4 pb-4">
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {currentRoute.approachStrategy}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 무브 가이드 — 인터랙티브, 탭하면 이미지에서 해당 홀드 하이라이트 */}
        {currentRoute && currentRoute.steps.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined">directions_run</span>
              무브 가이드
            </h3>
            <p className="text-[11px] text-on-surface-variant mb-4">스텝을 탭하면 이미지에서 위치를 확인할 수 있습니다</p>
            <MoveGuide
              steps={currentRoute.steps}
              holds={currentRoute.holds}
              activeStepIdx={activeStepIdx}
              onStepTap={handleStepTap}
              routeColor={currentColor}
            />
          </div>
        )}

        {/* 핵심 팁 */}
        {currentRoute?.keyTips && currentRoute.keyTips.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">tips_and_updates</span>
              핵심 팁
            </h4>
            <div className="flex flex-wrap gap-2">
              {currentRoute.keyTips.map((tip, i) => (
                <div key={i} className="bg-primary-fixed/30 rounded-xl px-4 py-3 flex-1 min-w-0" style={{ minWidth: "140px" }}>
                  <p className="text-xs text-on-surface leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 추가 루트 — 아코디언 */}
      {additionalRoutes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest px-1">
            대안 루트
          </h3>
          {additionalRoutes.map((route, i) => {
            const routeIdx = i + 1;
            return (
              <CompactRouteCard
                key={i}
                route={route}
                index={routeIdx}
                routeColor={ROUTE_COLORS[routeIdx % ROUTE_COLORS.length]}
                isSelected={activeRouteIdx === routeIdx}
                onSelect={() => handleRouteSwitch(routeIdx)}
                activeStepIdx={activeRouteIdx === routeIdx ? activeStepIdx : null}
                onStepTap={handleStepTap}
              />
            );
          })}
        </div>
      )}

      {/* 벽 설명 */}
      <div className="bg-surface-container-low rounded-2xl p-5">
        <h4 className="text-xs font-bold text-on-surface-variant mb-2 flex items-center gap-1.5 uppercase tracking-widest">
          <span className="material-symbols-outlined text-[16px]">info</span>
          벽 분석 요약
        </h4>
        <p className="text-sm text-on-surface leading-relaxed">{result.wallDescription}</p>
      </div>

      {/* 전반적인 조언 */}
      {result.generalAdvice && (
        <div className="bg-surface-container-low rounded-2xl p-5">
          <h4 className="text-xs font-bold text-on-surface-variant mb-2 flex items-center gap-1.5 uppercase tracking-widest">
            <span className="material-symbols-outlined text-[16px]">lightbulb</span>
            전반적인 조언
          </h4>
          <p className="text-sm text-on-surface leading-relaxed">{result.generalAdvice}</p>
        </div>
      )}
    </div>
  );
}
