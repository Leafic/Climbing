"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const dismissed = sessionStorage.getItem("install-prompt-dismissed-session")
      || localStorage.getItem("install-prompt-dismissed");
    if (dismissed) {
      if (sessionStorage.getItem("install-prompt-dismissed-session")) return;
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const visits = parseInt(localStorage.getItem("visit-count") || "0", 10) + 1;
    localStorage.setItem("visit-count", String(visits));
    if (visits < 3) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("install-prompt-dismissed", String(Date.now()));
    sessionStorage.setItem("install-prompt-dismissed-session", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 bg-surface-container-lowest rounded-2xl shadow-ambient-lg p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary">download</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-on-surface">ClimbAI 앱 설치</p>
        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
          {isIOS
            ? "공유 버튼 → '홈 화면에 추가'를 눌러 앱으로 사용하세요"
            : "메뉴 → '홈 화면에 추가'를 눌러 앱으로 사용하세요"}
        </p>
      </div>
      <button onClick={dismiss} className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0 p-1">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}
