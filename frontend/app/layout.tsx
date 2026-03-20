import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "./pwa-register";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "ClimbAI - 클라이밍 AI 분석기",
  description: "클라이밍 영상을 AI로 분석해드립니다",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClimbAI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-gray-50 text-gray-900">
        <div id="app-shell">
          <header className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <a href="/" className="text-lg font-bold text-blue-600">
                🧗 ClimbAI
              </a>
              <a href="/admin" className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors">
                dev
              </a>
            </div>
          </header>
          <div id="app-main">
            <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
              {children}
            </div>
          </div>
          <BottomNav />
        </div>
        <InstallPrompt />
        <PWARegister />
      </body>
    </html>
  );
}
