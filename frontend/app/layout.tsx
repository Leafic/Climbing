import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "클라이밍 AI 분석기",
  description: "클라이밍 영상을 AI로 분석해드립니다",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <a href="/" className="text-lg font-bold text-blue-600">
              🧗 ClimbAI
            </a>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
