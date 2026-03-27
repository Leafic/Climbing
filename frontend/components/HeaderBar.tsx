"use client";

import { useTheme } from "./ThemeProvider";

export default function HeaderBar() {
  const { resolved, toggle } = useTheme();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{ backgroundColor: "var(--glass-bg)" }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between px-6 py-3">
        <a href="/" className="flex items-center gap-1.5">
          <span className="text-2xl font-black tracking-tighter text-primary font-headline">
            ClimbAI
          </span>
        </a>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-90"
            aria-label={resolved === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            <span className="material-symbols-outlined text-[22px]">
              {resolved === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
