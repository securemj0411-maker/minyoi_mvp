import Link from "next/link";

export function AdminCaughtPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#050505] px-6 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_25%_85%,rgba(245,158,11,0.12),transparent_32%),linear-gradient(180deg,#050505_0%,#10100d_100%)]" />
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative w-full max-w-xl text-center">
        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full border border-emerald-300/20 bg-black shadow-[0_0_80px_rgba(16,185,129,0.22),inset_0_-28px_54px_rgba(16,185,129,0.10)]">
          <div className="relative h-44 w-44">
            <div className="absolute left-7 top-11 h-11 w-11 rounded-full bg-emerald-200 shadow-[0_0_26px_rgba(110,231,183,0.95)]">
              <div className="absolute left-4 top-4 h-4 w-4 rounded-full bg-black" />
            </div>
            <div className="absolute right-7 top-11 h-11 w-11 rounded-full bg-emerald-200 shadow-[0_0_26px_rgba(110,231,183,0.95)]">
              <div className="absolute right-4 top-4 h-4 w-4 rounded-full bg-black" />
            </div>
            <div className="absolute left-1/2 top-24 h-16 w-32 -translate-x-1/2 overflow-hidden rounded-b-full border-b-[10px] border-emerald-200 shadow-[0_18px_28px_rgba(16,185,129,0.12)]">
              <div className="absolute left-5 top-4 h-2 w-3 rounded-full bg-emerald-200" />
              <div className="absolute left-12 top-7 h-2 w-3 rounded-full bg-emerald-200" />
              <div className="absolute right-5 top-4 h-2 w-3 rounded-full bg-emerald-200" />
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.42em] text-emerald-300/80">
          access attempt noticed
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
          딱 걸렸죠?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-6 text-zinc-300">
          거긴 막힌 문이에요. 손잡이 만지는 소리까지 다 들립니다.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_14px_34px_rgba(16,185,129,0.26)] transition hover:bg-emerald-200"
          >
            조용히 돌아가기
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400">
            403 · nice try
          </span>
        </div>
      </div>
    </main>
  );
}
