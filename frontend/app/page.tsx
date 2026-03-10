import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center py-16 gap-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          클라이밍 영상 AI 분석
        </h1>
        <p className="text-gray-500 text-base max-w-md">
          30초~3분 영상을 업로드하면 AI가 실패 원인, 자세, 발 위치, 무게중심을
          분석하고 완등 전략을 제안합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-sm">
        {[
          { icon: "📹", label: "영상 업로드" },
          { icon: "🤖", label: "AI 자동 분석" },
          { icon: "💬", label: "피드백 반영 재분석" },
          { icon: "📈", label: "완등 가능성 계산" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-gray-700 font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      <Link
        href="/upload"
        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        지금 분석하기
      </Link>
    </div>
  );
}
