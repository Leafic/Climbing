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
  themeColor: "#004ac6",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-surface min-h-screen text-on-surface font-body">
        <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-md mx-auto flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <a href="/" className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant">menu</span>
                <span className="text-2xl font-extrabold tracking-tighter text-primary font-headline">
                  ClimbAI
                </span>
              </a>
            </div>
            <a href="/admin" className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">settings_applications</span>
            </a>
          </div>
        </header>
        <main className="max-w-md mx-auto px-6 py-8 pb-32">{children}</main>
        <BottomNav />
        <InstallPrompt />
        <PWARegister />
      </body>
    </html>
  );
}
