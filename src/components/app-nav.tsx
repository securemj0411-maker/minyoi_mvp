"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import CreditIcon from "@/components/credit-icon";
import { displayNameForUser, isAdminUser } from "@/lib/auth-users";
import { hasClientAdminOverride, setClientAdminOverride } from "@/lib/client-admin-override";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate mismatch를 막기 위해 마운트 뒤 저장된 테마를 1회 반영한다.
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
      <div className={`flex items-center gap-1 rounded-full border border-[#ddd4c7] bg-[#fbf8f2] p-1 shadow-[0_8px_18px_rgba(45,57,48,0.06)] dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-label="라이트 모드"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            !effectiveDark
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-[#5f675e] hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
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
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-[#5f675e] hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <MoonIcon />
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[#ddd4c7] bg-[#fbf8f2] p-0.5 text-[11px] font-semibold shadow-[0_8px_18px_rgba(45,57,48,0.06)] dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      {[
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value as ThemeMode)}
          className={`rounded-lg px-2.5 py-1.5 transition ${
            theme === value
              ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
              : "text-[#5f675e] hover:bg-[var(--brand-accent-soft)] dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {label}
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

export default function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState(0);
  const [infiniteCredits, setInfiniteCredits] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [adminOverride, setAdminOverride] = useState(false);
  const adminClickCountRef = useRef(0);
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const admin = isAdminUser(user) || adminOverride;
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
  }, []);

  const handleAdminDotClick = useCallback(() => {
    if (adminClickTimerRef.current) clearTimeout(adminClickTimerRef.current);
    adminClickCountRef.current += 1;
    if (adminClickCountRef.current >= 5) {
      adminClickCountRef.current = 0;
      const next = !hasClientAdminOverride();
      setClientAdminOverride(next);
      setAdminOverride(next);
      if (typeof window !== "undefined") window.alert(`운영자 모드 ${next ? "ON" : "OFF"}`);
      return;
    }
    adminClickTimerRef.current = setTimeout(() => {
      adminClickCountRef.current = 0;
    }, 1500);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  // mobile drawer: route 변경 시 자동 close, Esc 닫기, body scroll lock.
  useEffect(() => {
    setMobileDrawerOpen(false);
    setAccountSheetOpen(false);
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
    { href: "/how-it-works", label: "서비스 안내" },
    { href: "/plans", label: "요금제" },
    ...(user ? [{ href: "/me", label: "내 대시보드" }] : []),
    ...(admin ? [{ href: "/debug", label: "운영 로그" }] : []),
  ];

  return (
    <>
    <nav className="sticky top-0 z-40 border-b border-[#e2d9cb] bg-[#f8f4ec]/92 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto grid max-w-[1380px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:px-6 md:gap-3 md:px-4 lg:px-8">
        {/* 왼쪽: mobile = 햄버거, desktop = 로고 + admin dot */}
        <div className="flex items-center gap-2 justify-self-start">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#344136] transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800 md:hidden"
          >
            <HamburgerIcon />
          </button>
          <button
            type="button"
            onClick={handleAdminDotClick}
            aria-label="admin-toggle"
            className={`hidden h-2 w-2 rounded-full transition-colors md:block ${adminOverride ? "bg-emerald-500" : "bg-[#d6cdbc] dark:bg-zinc-700"}`}
          />
          <Link href="/" className="hidden items-center gap-2 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-black text-white shadow-md shadow-emerald-500/20">
              M
            </div>
            <span className="font-black tracking-tight text-[#223127] dark:text-white">미뇨이</span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-900">
              Beta
            </span>
          </Link>
        </div>

        {/* 가운데: mobile = "미뇨이" 텍스트, desktop = nav links */}
        <Link href="/" className="flex items-center justify-self-center md:hidden">
          <span className="text-base font-black tracking-tight text-[#223127] dark:text-white">미뇨이</span>
        </Link>

        <div className="hidden items-center justify-self-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                isActive(pathname, link.href)
                  ? "bg-[var(--brand-accent)] text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] dark:bg-zinc-100 dark:text-zinc-950"
                  : "text-[#5f675e] hover:bg-[var(--brand-accent-soft)] hover:text-[var(--brand-accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-self-end gap-1.5">
          {/* mobile 전용: 로그인 시 대시보드 / 비로그인 시 로그인 */}
          {user ? (
            <Link
              href="/me"
              className="inline-flex h-9 items-center rounded-xl bg-[var(--brand-accent-strong)] px-3 text-xs font-black text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] transition hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-950 md:hidden"
            >
              대시보드
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-xl border border-[#ddd4c7] bg-[#fbf8f2] px-3 text-xs font-black text-[#344136] shadow-[0_8px_18px_rgba(45,57,48,0.06)] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:hidden"
            >
              로그인
            </Link>
          )}

          {/* desktop 전용: 기존 credits + account menu */}
          {user ? (
            <>
              <div className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#cfd9c9] bg-[#edf4e8] px-2.5 shadow-[0_8px_16px_rgba(92,116,95,0.10)] dark:border-zinc-700/70 dark:bg-zinc-900 md:flex">
                <CreditIcon size={20} className="shrink-0 drop-shadow-[0_1px_1px_rgba(63,42,10,0.25)]" />
                <span className="text-xs font-black leading-none tabular-nums text-[#223127] dark:text-zinc-100">
                  {infiniteCredits ? "∞" : tokens}
                </span>
              </div>
              {admin ? (
                <Link
                  href="/plans"
                  className="hidden h-9 items-center rounded-xl border border-[#cfd9c9] bg-[#fbf8f2] px-2.5 text-xs font-black leading-none text-[#344136] shadow-[0_8px_18px_rgba(45,57,48,0.06)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
                >
                  충전하기
                </Link>
              ) : null}
              <div ref={menuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-[#ddd4c7] bg-[#fbf8f2] px-2.5 text-left text-xs leading-none shadow-[0_8px_18px_rgba(45,57,48,0.06)] transition hover:bg-[#f1ebe1] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-[10px] font-black leading-none text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
                    {userInitial}
                  </span>
	                  <span className="hidden min-w-0 sm:block">
	                    <span className="block max-w-16 truncate text-xs font-black leading-none text-[#223127] dark:text-zinc-100">{userName}</span>
	                  </span>
                  <span className="text-[10px] leading-none text-zinc-400">{menuOpen ? "▴" : "▾"}</span>
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl border border-[#ddd4c7] bg-[#fbf8f2] p-2 shadow-[0_20px_40px_rgba(45,57,48,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
	                    <div className="rounded-xl px-3 py-2">
	                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">계정</div>
	                      <div className="mt-1 truncate text-sm font-black text-[#223127] dark:text-zinc-100">{userName}</div>
	                      {user.email ? (
	                        <div className="mt-0.5 truncate text-xs font-semibold text-[#6b7269] dark:text-zinc-400">{user.email}</div>
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
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-[#344136] transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                className="hidden rounded-xl border border-[#ddd4c7] bg-[#fbf8f2] px-3 py-1.5 text-xs font-black text-[#344136] shadow-[0_8px_18px_rgba(45,57,48,0.06)] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:inline-flex"
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
          className={`absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] flex-col bg-[#f8f4ec] shadow-[0_24px_64px_rgba(34,49,39,0.24)] transition-transform duration-300 ease-out dark:bg-zinc-950 ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
            {/* drawer header */}
            <div className="flex items-center justify-between border-b border-[#e2d9cb] px-4 py-3 dark:border-zinc-800">
              <Link href="/" onClick={() => setMobileDrawerOpen(false)} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-black text-white shadow-md shadow-emerald-500/20">
                  M
                </div>
                <span className="font-black tracking-tight text-[#223127] dark:text-white">미뇨이</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="메뉴 닫기"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#344136] hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <CloseIcon />
              </button>
            </div>

            {/* nav links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-black transition ${
                      isActive(pathname, link.href)
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-[#344136] hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>{link.label}</span>
                    <span className="text-zinc-400">↗</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* bottom: 크레딧 + 화면 모드 + 계정 chip (chip 클릭 시 bottom sheet) */}
            <div className="border-t border-[#e2d9cb] p-3 dark:border-zinc-800">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[#edf4e8] px-3 py-2.5 dark:bg-zinc-900">
                    <span className="text-xs font-black text-[#5d735f] dark:text-emerald-400">크레딧</span>
                    <div className="flex items-center gap-1.5">
                      <CreditIcon size={20} className="shrink-0" />
                      <span className="text-sm font-black tabular-nums text-[#223127] dark:text-zinc-100">
                        {infiniteCredits ? "∞" : tokens}
                      </span>
                    </div>
                  </div>
                  {/* 계정 chip — 클릭 시 bottom sheet (이메일/플랜/화면모드/충전/로그아웃) */}
                  <button
                    type="button"
                    onClick={() => setAccountSheetOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#fffaf1] px-3 py-2.5 text-left transition hover:bg-[var(--brand-accent-soft)] dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-sm font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
                      {userInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-[#223127] dark:text-zinc-100">{userName}</div>
                      <div className="text-[11px] font-semibold text-[#7a8478] dark:text-zinc-500">계정 관리</div>
                    </div>
                    <span className="text-zinc-400">▴</span>
                  </button>
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
                  <div className="rounded-xl bg-[#fffaf1] px-3 py-2.5 dark:bg-zinc-900">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5d735f] dark:text-emerald-400">화면 모드</div>
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
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-[#fffaf1] p-4 pb-6 shadow-[0_-12px_32px_rgba(34,49,39,0.18)] transition-transform duration-300 ease-out dark:bg-zinc-950 ${
            accountSheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[#ddd4c7] dark:bg-zinc-700" />
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f6efe4] px-3 py-3 dark:bg-zinc-900">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-base font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
              {userInitial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-black text-[#223127] dark:text-zinc-100">{userName}</div>
              {user.email ? (
                <div className="truncate text-xs font-semibold text-[#6b7269] dark:text-zinc-400">{user.email}</div>
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
          <div className="mt-3 rounded-xl bg-[#fffaf1] px-3 py-2.5 dark:bg-zinc-950/50">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5d735f] dark:text-emerald-400">화면 모드</div>
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
