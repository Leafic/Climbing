"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: "H", match: (p: string) => p === "/" },
  { href: "/upload", label: "영상 분석", icon: "V", match: (p: string) => p === "/upload" },
  { href: "/route-finder", label: "루트 찾기", icon: "R", match: (p: string) => p.startsWith("/route-finder") },
  { href: "/analyses", label: "내 분석", icon: "M", match: (p: string) => p.startsWith("/analyses") || p.startsWith("/analysis/") },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="bg-white border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 ${
                active ? "text-blue-600 font-semibold" : "text-gray-400"
              }`}
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                active ? "bg-blue-100 text-blue-600" : ""
              }`}>
                {item.icon}
              </span>
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
