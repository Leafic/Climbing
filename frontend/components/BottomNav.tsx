"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: "home", match: (p: string) => p === "/" },
  { href: "/upload", label: "영상 분석", icon: "movie_filter", match: (p: string) => p === "/upload" },
  { href: "/route-finder", label: "루트 파인더", icon: "explore", match: (p: string) => p.startsWith("/route-finder") },
  { href: "/analyses", label: "내 분석", icon: "analytics", match: (p: string) => p.startsWith("/analyses") || p.startsWith("/analysis/") },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 w-full backdrop-blur-2xl z-50 rounded-t-3xl shadow-nav pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: "var(--glass-bg-heavy)" }}
    >
      <div className="flex justify-around items-center px-4 pb-8 pt-4">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 min-w-[56px] transition-all duration-300 ease-out active:scale-95 ${
                active
                  ? "text-primary font-bold scale-110"
                  : "text-on-surface-variant opacity-50 hover:opacity-80"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[28px] ${
                  active ? "material-symbols-filled" : ""
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
