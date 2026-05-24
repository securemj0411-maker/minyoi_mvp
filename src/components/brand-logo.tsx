// Wave launch-120 (2026-05-24): 공통 brand mark 컴포넌트.
//   기존 가격표 디자인 → piggy 디자인 (사용자 정정).
//   사용처: app-nav, login, preview-server hero. (icon/apple-icon/og 는 ImageResponse 라 inline 필요.)
//
// elements:
//   배경 rect (rx 22, #0064FF)
//   별 3개 (좌상/우상/우하) — sparkles
//   머리 (큰 흰 원) + 귀 2개 (삼각형)
//   얼굴 (작은 파랑 원)
//   눈 2개 (작은 흰 원)
//   코 (흰 ellipse)
//   입 (지그재그 path stroke)

export function BrandLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#0064FF" />
      {/* sparkles */}
      <path d="M14 28 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill="#fff" />
      <path d="M86 28 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill="#fff" />
      <path d="M84 70 l1.5 3 l3 1.5 l-3 1.5 l-1.5 3 l-1.5 -3 l-3 -1.5 l3 -1.5 z" fill="#fff" />
      {/* piggy head */}
      <circle cx="50" cy="52" r="38" fill="#fff" />
      {/* ears */}
      <path d="M28 40 L34 32 L38 48 Z" fill="#fff" />
      <path d="M72 40 L66 32 L62 48 Z" fill="#fff" />
      {/* inner face */}
      <circle cx="50" cy="58" r="24" fill="#0064FF" />
      {/* eyes */}
      <circle cx="42" cy="54" r="2.4" fill="#fff" />
      <circle cx="58" cy="54" r="2.4" fill="#fff" />
      {/* snout */}
      <ellipse cx="50" cy="66" rx="11" ry="7" fill="#fff" />
      {/* mouth zigzag */}
      <path d="M44 64 L46 70 L48 66 L50 70 L52 66 L54 70 L56 64" stroke="#fff" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
