"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import CreditIcon from "@/components/credit-icon";
import { displayNameForUser, isAdminUser } from "@/lib/auth-users";
import { hasClientAdminOverride, setClientAdminOverride } from "@/lib/client-admin-override";
import { hasAdminShadowClient, setAdminShadowClient } from "@/lib/admin-shadow-mode";
import { loadClientCredits } from "@/lib/client-credits";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ThemeMode = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "minyoi-theme-v1";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function loadTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    return "system";
  }
  return "system";
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 15.1A8.5 8.5 0 0 1 8.9 4a9 9 0 1 0 11.1 11.1Z"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  );
}

function ThemeToggle({
  className = "",
  variant = "full",
}: {
  className?: string;
  variant?: "full" | "compact";
}) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [themeReady, setThemeReady] = useState(false);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const nextTheme = loadTheme();
    setTheme(nextTheme);
    setThemeReady(true);
    setPrefersDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setPrefersDark(media.matches);
      if (theme === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, themeReady]);

  const effectiveDark = theme === "dark" || (theme === "system" && prefersDark);

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-label="라이트 모드"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            !effectiveDark
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(49,130,246,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-600 hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <SunIcon />
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-label="다크 모드"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            effectiveDark
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(49,130,246,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-600 hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <MoonIcon />
        </button>
      </div>
    );
  }

  const items: Array<[ThemeMode, string, ReactNode]> = [
    ["system", "시스템", <SystemIcon key="sys" />],
    ["light", "라이트", <SunIcon key="sun" />],
    ["dark", "다크", <MoonIcon key="moon" />],
  ];
  return (
    <div className={`flex items-stretch gap-0.5 rounded-xl border border-zinc-200 bg-white p-0.5 shadow-[0_8px_18px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      {items.map(([value, label, icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={label}
          title={label}
          className={`flex flex-1 items-center justify-center rounded-lg py-2 transition ${
            theme === value
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(49,130,246,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-600 hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

// Wave launch-101 (사용자 정정 — 운영자 페이지 nav 거추장): cau* admin path 면 minimal nav.
//   메인 페이지 가는 button 1개 + 흐릿 ⚙ admin badge만. 다른 user-facing nav 다 hide.
function AdminTerminalNav() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-40 h-10 border-b border-zinc-700/60 bg-zinc-950 px-4 text-xs font-mono">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between">
        <div className="flex items-center gap-3 text-amber-400">
          <span className="text-[11px] font-black uppercase tracking-[0.18em]">▌MINYOI TERM</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:inline">OPERATOR CONSOLE</span>
        </div>
        <a
          href="/"
          className="inline-flex h-7 items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 text-[11px] font-bold text-zinc-300 transition hover:border-amber-500/60 hover:bg-zinc-800 hover:text-amber-300"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8M5 10v10h14V10" />
          </svg>
          MAIN
        </a>
      </div>
    </nav>
  );
}

export default function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState(0);
  const [infiniteCredits, setInfiniteCredits] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creditMenuOpen, setCreditMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const creditMenuRef = useRef<HTMLDivElement | null>(null);
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminShadow, setAdminShadow] = useState(false);
  const adminClickCountRef = useRef(0);
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realAdmin = isAdminUser(user);
  // Wave 106: admin이지만 shadow mode면 일반 user UI. non-admin이지만 adminOverride면 admin UI.
  const admin = (realAdmin && !adminShadow) || (!realAdmin && adminOverride);
  const userName = useMemo(() => displayNameForUser(user), [user]);
  const userInitial = useMemo(() => (userName || "U").trim().charAt(0).toUpperCase(), [userName]);

  const refreshCredits = useCallback(async () => {
    const credits = await loadClientCredits().catch(() => null);
    if (!credits) {
      setTokens(0);
      setInfiniteCredits(false);
      return;
    }
    setTokens(credits.tokens);
    setInfiniteCredits(credits.infinite);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.user ?? null;
      setUser(nextUser);
      if (nextUser) void refreshCredits();
    }).catch(() => undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        void refreshCredits();
      } else {
        setTokens(0);
        setInfiniteCredits(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshCredits]);

  useEffect(() => {
    const handler = () => { void refreshCredits(); };
    window.addEventListener("minyoi:credits-changed", handler);
    return () => window.removeEventListener("minyoi:credits-changed", handler);
  }, [refreshCredits]);

  useEffect(() => {
    setAdminOverride(hasClientAdminOverride());
    setAdminShadow(hasAdminShadowClient());
  }, []);

  const handleAdminDotClick = useCallback(() => {
    if (adminClickTimerRef.current) clearTimeout(adminClickTimerRef.current);
    adminClickCountRef.current += 1;
    if (adminClickCountRef.current >= 5) {
      adminClickCountRef.current = 0;
      if (realAdmin) {
        // Wave 106: 실제 admin이 5번 클릭 → shadow mode toggle (일반인 가장).
        const next = !hasAdminShadowClient();
        setAdminShadowClient(next);
        setAdminShadow(next);
        if (typeof window !== "undefined") {
          window.alert(`Shadow Mode ${next ? "ON (일반인 가장 — rate limit / 플랜 게이팅 / 무한 크레딧 해제)" : "OFF (운영자 복귀)"}`);
          window.location.reload(); // server-side cookie 검사 반영
        }
      } else {
        // non-admin → 기존 client-only admin UI 가장 (Wave 69).
        const next = !hasClientAdminOverride();
        setClientAdminOverride(next);
        setAdminOverride(next);
        if (typeof window !== "undefined") window.alert(`운영자 모드 ${next ? "ON" : "OFF"}`);
      }
      return;
    }
    adminClickTimerRef.current = setTimeout(() => {
      adminClickCountRef.current = 0;
    }, 1500);
  }, [realAdmin]);

  useEffect(() => {
    if (!menuOpen && !creditMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false);
      if (creditMenuOpen && !creditMenuRef.current?.contains(target)) setCreditMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen, creditMenuOpen]);

  // mobile drawer: route 변경 시 자동 close, Esc 닫기, body scroll lock.
  useEffect(() => {
    setMobileDrawerOpen(false);
    setAccountSheetOpen(false);
    setCreditMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileDrawerOpen && !accountSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (accountSheetOpen) setAccountSheetOpen(false);
      else setMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileDrawerOpen, accountSheetOpen]);

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  }, []);

  const navLinks = [
    { href: "/", label: "추천 상품" },
    // Wave 343: /explore 폐기 — /me history view에 통합. nav "탐색" 링크 제거.
    { href: "/how-it-works", label: "서비스 안내" },
    { href: "/plans", label: "크레딧 충전" },
    ...(user ? [{ href: "/me", label: "내 대시보드" }] : []),
    ...(admin ? [{ href: "/debug", label: "운영 로그" }] : []),
  ];
  const mobileHomeHref = user ? "/me" : "/";
  const mobileNavLinks = user
    ? [
        { href: "/me", label: "추천 피드", caption: "오늘 볼 만한 매물" },
        // Wave 726 (2026-05-23): 모바일에서 sidebar 숨김 (lg:block) 이라 텔레그램 알림 설정 접근 불가.
        //   모바일 사용자가 한 번이라도 설정 가능하게 drawer 에 link 박음.
        { href: "/me?view=hotdeal-alerts", label: "핫딜 알림", caption: "텔레그램 알림 설정" },
        // Wave 731 (2026-05-24): 친구 초대 — 가입 시 양쪽 +5 / 첫 결제 시 추천인 +3/+30/+60
        { href: "/invite", label: "친구 초대", caption: "가입하면 둘 다 +5 크레딧" },
        { href: "/plans", label: "크레딧 충전", caption: "상세 분석 열기" },
        { href: "/how-it-works", label: "서비스 안내", caption: "득템잡이 사용법" },
        ...(admin ? [{ href: "/debug", label: "운영 로그", caption: "관리자 전용" }] : []),
      ]
    : [
        { href: "/", label: "추천 상품", caption: "오늘의 후보" },
        { href: "/how-it-works", label: "서비스 안내", caption: "득템잡이 사용법" },
        { href: "/plans", label: "크레딧 충전", caption: "가격 보기" },
      ];

  // Wave launch-101 (사용자 정정 — 운영자 페이지 nav 거추장): cau* admin path 면 minimal terminal nav.
  //   모든 hook 호출 후라서 React rules of hooks 안전. 메인 가는 button 1개만 노출.
  if (pathname && pathname.startsWith("/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY")) {
    return <AdminTerminalNav />;
  }

  // Wave launch-112 (2026-05-24): 로그인/회원가입/콜백 페이지는 nav hide (다른 사이트 표준 패턴).
  //   로그인 페이지에서 다른 메뉴로 나갈 일 없음 — focused 한 단일 액션 화면.
  if (pathname === "/login" || pathname === "/signup" || pathname?.startsWith("/auth/")) {
    return null;
  }

  return (
    <>
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/92 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto grid max-w-[1380px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:px-6 md:gap-3 md:px-4 lg:px-8">
        {/* 왼쪽: mobile = 햄버거, desktop = 로고 + admin dot */}
        <div className="flex items-center gap-2 justify-self-start">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-900 transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800 md:hidden"
          >
            <HamburgerIcon />
          </button>
          <button
            type="button"
            onClick={handleAdminDotClick}
            aria-label="admin-toggle"
            className={`hidden h-2 w-2 rounded-full transition-colors md:block ${adminOverride ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
          />
          <Link href="/" className="hidden items-center gap-2 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-black text-white shadow-md shadow-blue-500/20">
              D
            </div>
            <span className="font-black tracking-tight text-zinc-950 dark:text-white">득템잡이</span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-900">
              Beta
            </span>
          </Link>
        </div>

        {/* 가운데: mobile = "득템잡이" 텍스트, desktop = nav links */}
        <Link href={mobileHomeHref} className="flex items-center justify-self-center md:hidden">
          <span className="text-base font-black tracking-tight text-zinc-950 dark:text-white">득템잡이</span>
        </Link>

        <div className="hidden items-center justify-self-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                isActive(pathname, link.href)
                  ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(49,130,246,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-[var(--brand-accent-soft)] hover:text-[var(--brand-accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-self-end gap-1.5">
          {/* mobile 전용: 로그인 시 크레딧 잔액만 상시 노출 / 비로그인 시 로그인 */}
          {user ? (
            <div className="flex items-center gap-1 md:hidden">
              <Link
                href="/plans"
                aria-label={`크레딧 ${infiniteCredits ? "무제한" : `${tokens}개`} 충전하기`}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-blue-100 bg-blue-50 px-2.5 text-xs font-black tabular-nums text-zinc-950 shadow-[0_8px_14px_rgba(49,130,246,0.10)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <CreditIcon size={16} className="shrink-0" />
                {infiniteCredits ? "∞" : tokens}
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:hidden"
            >
              로그인
            </Link>
          )}

          {/* desktop 전용: 기존 credits + account menu */}
          {user ? (
            <>
              <div ref={creditMenuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => {
                    setCreditMenuOpen((prev) => !prev);
                    setMenuOpen(false);
                  }}
                  aria-expanded={creditMenuOpen}
                  aria-label="크레딧 충전 메뉴 열기"
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-2.5 shadow-[0_8px_16px_rgba(49,130,246,0.10)] transition hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700/70 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <CreditIcon size={20} className="shrink-0 drop-shadow-[0_1px_1px_rgba(63,42,10,0.25)]" />
                  <span className="text-xs font-black leading-none tabular-nums text-zinc-950 dark:text-zinc-100">
                    {infiniteCredits ? "∞" : tokens}
                  </span>
                  <span className="text-[10px] leading-none text-zinc-500 dark:text-zinc-500">{creditMenuOpen ? "▴" : "▾"}</span>
                </button>
                {creditMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_20px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="rounded-xl bg-white px-3 py-3 dark:bg-zinc-950/50">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">보유 크레딧</div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditIcon size={24} className="shrink-0" />
                          <span className="text-2xl font-black tabular-nums text-zinc-950 dark:text-zinc-100">
                            {infiniteCredits ? "∞" : tokens}
                          </span>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-[#3182f6] dark:bg-emerald-950/30 dark:text-emerald-200">
                          즉시 사용
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                        부족하면 크레딧 패키지를 단건 충전할 수 있어요.
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <Link
                        href="/plans"
                        onClick={() => setCreditMenuOpen(false)}
                        className="flex items-center justify-between rounded-xl bg-[var(--brand-accent-strong)] px-3 py-2.5 text-sm font-black text-[var(--brand-cream)] transition hover:opacity-90"
                      >
                        <span>크레딧 충전하기</span>
                        <span>→</span>
                      </Link>
                      <Link
                        href="/plans"
                        onClick={() => setCreditMenuOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <span>크레딧 패키지 보기</span>
                        <span className="text-zinc-400">↗</span>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
              {admin ? (
                <Link
                  href="/plans"
                  className="hidden h-9 items-center rounded-xl border border-blue-100 bg-white px-2.5 text-xs font-black leading-none text-zinc-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
                >
                  충전하기
                </Link>
              ) : null}
              <div ref={menuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 text-left text-xs leading-none shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-[10px] font-black leading-none text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
                    {userInitial}
                  </span>
	                  <span className="hidden min-w-0 sm:block">
	                    <span className="block max-w-16 truncate text-xs font-black leading-none text-zinc-950 dark:text-zinc-100">{userName}</span>
	                  </span>
                  <span className="text-[10px] leading-none text-zinc-400">{menuOpen ? "▴" : "▾"}</span>
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_40px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
	                    <div className="rounded-xl px-3 py-2">
	                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">계정</div>
	                      <div className="mt-1 truncate text-sm font-black text-zinc-950 dark:text-zinc-100">{userName}</div>
	                      {user.email ? (
	                        <div className="mt-0.5 truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">{user.email}</div>
	                      ) : null}
	                    </div>
                    <div className="px-2 py-1">
                      <AccountPanel
                        tokens={tokens}
                        infiniteCredits={infiniteCredits}
                        variant="desktop"
                        onCloseAfterAction={() => setMenuOpen(false)}
                      />
                    </div>
                    <div className="rounded-xl px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">화면 모드</div>
                      <ThemeToggle className="mt-2 w-full" />
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span>로그아웃</span>
                      <span className="text-zinc-400">↗</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <ThemeToggle variant="compact" className="hidden md:flex" />
              <Link
                href="/login"
                className="hidden rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
              >
                카카오 로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>

    {/* Mobile drawer — nav 밖에 위치 (nav의 backdrop-blur stacking context를 escape) */}
    {/* 항상 mount + 클래스 토글로 부드럽게 transition (slide + fade) */}
    <div
        className={`fixed inset-0 z-50 md:hidden ${mobileDrawerOpen ? "" : "pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileDrawerOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            mobileDrawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileDrawerOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] flex-col bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)] transition-transform duration-300 ease-out dark:bg-zinc-950 ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
            {/* drawer header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              {user ? (
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(true)}
                  className="-ml-1 flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1.5 text-left ring-1 ring-transparent transition hover:bg-[var(--brand-accent-soft)] hover:ring-blue-100 active:scale-[0.99] dark:hover:bg-zinc-900 dark:hover:ring-zinc-800"
                  aria-label="계정 관리 열기"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-sm font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
                    {userInitial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black tracking-tight text-zinc-950 dark:text-white">
                      {userName}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      계정 설정 열기
                    </span>
                  </span>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-black text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    →
                  </span>
                </button>
              ) : (
                <div className="min-w-0">
                  <div className="text-[15px] font-black tracking-tight text-zinc-950 dark:text-white">
                    로그인하고 시작하기
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    첫 3개 상세 리포트 무료
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="메뉴 닫기"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-900 hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <CloseIcon />
              </button>
            </div>

            {/* nav links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              {user ? (
                <Link
                  href="/plans"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="mb-3 block rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-emerald-400">
                        보유 크레딧
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                        상세 분석을 열 때만 차감돼요
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-sm font-black tabular-nums text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
                      <CreditIcon size={18} className="shrink-0" />
                      {infiniteCredits ? "∞" : tokens}
                    </div>
                  </div>
                </Link>
              ) : null}
              <div className="space-y-1">
                {mobileNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition ${
                      isActive(pathname, link.href)
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-zinc-900 hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-black">{link.label}</span>
                      <span className={`mt-0.5 block text-[11px] font-semibold ${
                        isActive(pathname, link.href)
                          ? "text-white/70 dark:text-zinc-950/60"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}>
                        {link.caption}
                      </span>
                    </span>
                    <span className="text-zinc-400">↗</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* bottom: 화면 모드 */}
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              {user ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-zinc-900">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-emerald-400">화면 모드</div>
                    <ThemeToggle className="mt-2 w-full" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-3 py-2.5 text-sm font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950"
                  >
                    카카오 로그인
                  </Link>
                  <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-zinc-900">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-emerald-400">화면 모드</div>
                    <ThemeToggle className="mt-2 w-full" />
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

    {/* Mobile account bottom sheet — 계정 chip 누르면 아래에서 위로 슬라이드 */}
    {/* 항상 mount + 클래스 토글로 부드럽게 transition */}
    {user && (
      <div
        className={`fixed inset-0 z-[60] md:hidden ${accountSheetOpen ? "" : "pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!accountSheetOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            accountSheetOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setAccountSheetOpen(false)}
        />
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-6 shadow-[0_-12px_32px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out dark:bg-zinc-950 ${
            accountSheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-3 dark:bg-zinc-900">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-base font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
              {userInitial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-black text-zinc-950 dark:text-zinc-100">{userName}</div>
              {user.email ? (
                <div className="truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">{user.email}</div>
              ) : null}
            </div>
          </div>
          {/* 계정 사용량 + 액션 */}
          <div className="mt-3">
            <AccountPanel
              tokens={tokens}
              infiniteCredits={infiniteCredits}
              variant="mobile"
              onCloseAfterAction={() => { setAccountSheetOpen(false); setMobileDrawerOpen(false); }}
            />
          </div>
          {/* 화면 모드 */}
          <div className="mt-3 rounded-xl bg-white px-3 py-2.5 dark:bg-zinc-950/50">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-emerald-400">화면 모드</div>
            <ThemeToggle className="mt-2 w-full" />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => { setAccountSheetOpen(false); setMobileDrawerOpen(false); void handleSignOut(); }}
              className="flex w-full items-center justify-between rounded-xl bg-red-50 px-3 py-3 text-sm font-bold text-[#a04545] hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <span>로그아웃</span>
              <span>↗</span>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
