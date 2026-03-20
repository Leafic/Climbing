"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 이미 standalone (설치됨)이면 표시 안 함
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    // 이미 닫았으면 하루 동안 안 보여주기
    const dismissed = localStorage.getItem("install-prompt-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    }

    // 3회 이상 방문한 사용자에게만 표시
    const visits = parseInt(localStorage.getItem("visit-count") || "0", 10) + 1;
    localStorage.setItem("visit-count", String(visits));
    if (visits < 3) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("install-prompt-dismissed", String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 bg-white rounded-xl shadow-lg border border-blue-200 p-4 flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">ClimbAI 앱 설치</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {isIOS
            ? "공유 버튼 → '홈 화면에 추가'를 눌러 앱으로 사용하세요"
            : "메뉴 → '홈 화면에 추가'를 눌러 앱으로 사용하세요"}
        </p>
      </div>
      <button onClick={dismiss} className="text-gray-400 text-lg shrink-0 p-1">
        x
      </button>
    </div>
  );
}
