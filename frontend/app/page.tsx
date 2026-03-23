import Link from "next/link";

const FEATURES = [
  { icon: "videocam", label: "영상 분석하기", sub: "AI Pose Tracking", href: "/upload", color: "bg-primary-fixed text-primary" },
  { icon: "explore", label: "루트 파인더", sub: "Optimal Beta AI", href: "/route-finder", color: "bg-secondary-container/30 text-secondary" },
  { icon: "analytics", label: "내 분석 이력", sub: "Progress Stats", href: "/analyses", color: "bg-tertiary-container/20 text-tertiary" },
  { icon: "groups", label: "커뮤니티/팁", sub: "Expert Beta", href: "#", color: "bg-surface-container-high text-on-surface-variant" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <div className="pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">
          Smart Climbing Assistant
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-on-surface font-headline">
          클라이밍 영상{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
            AI 분석
          </span>
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed mt-3">
          당신의 무브를 정밀하게 분석하고
          <br />
          완등을 위한 최적의 경로를 제안합니다.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col justify-between aspect-square shadow-ambient active:scale-95 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm">{item.label}</p>
              <p className="text-[10px] text-on-surface-variant opacity-70 mt-0.5">{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* FAB */}
      <Link
        href="/upload"
        className="fixed right-6 bottom-28 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center shadow-ambient-lg z-40 active:scale-90 transition-transform duration-300"
      >
        <span className="material-symbols-outlined text-[28px]">photo_camera</span>
      </Link>
    </div>
  );
}
