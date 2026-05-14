"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CreditIcon from "@/components/credit-icon";
import { displayNameForUser, isAdminUser } from "@/lib/auth-users";
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

export default function AppNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState(0);
  const [infiniteCredits, setInfiniteCredits] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const admin = isAdminUser(user);
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
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

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
    <nav className="sticky top-0 z-40 border-b border-[#e2d9cb] bg-[#f8f4ec]/92 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto grid max-w-[1380px] grid-cols-[auto_1fr] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link href="/" className="flex items-center gap-2 md:justify-self-start">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-black text-white shadow-md shadow-emerald-500/20">
            M
          </div>
          <span className="font-black tracking-tight text-[#223127] dark:text-white">미뇨이</span>
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-900">
            Beta
          </span>
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
          {user ? (
            <>
              <div className="flex h-9 items-center gap-1.5 rounded-xl border border-[#cfd9c9] bg-[#edf4e8] px-2.5 shadow-[0_8px_16px_rgba(92,116,95,0.10)] dark:border-zinc-700/70 dark:bg-zinc-900">
                <CreditIcon size={20} className="shrink-0 drop-shadow-[0_1px_1px_rgba(63,42,10,0.25)]" />
                <span className="text-xs font-black leading-none tabular-nums text-[#223127] dark:text-zinc-100">
                  {infiniteCredits ? "∞" : tokens}
                </span>
              </div>
              {admin ? (
                <Link
                  href="/plans"
                  className="hidden h-9 items-center rounded-xl border border-[#cfd9c9] bg-[#fbf8f2] px-2.5 text-xs font-black leading-none text-[#344136] shadow-[0_8px_18px_rgba(45,57,48,0.06)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:inline-flex"
                >
                  충전하기
                </Link>
              ) : null}
              <div ref={menuRef} className="relative">
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
                    <div className="rounded-xl px-3 py-2 text-sm text-[#5f675e] dark:text-zinc-300">
                      <div className="font-semibold text-[#223127] dark:text-zinc-100">요금제</div>
                      <div className="mt-1 text-xs text-[#6b7269] dark:text-zinc-400">Beta 무료 이용중</div>
                    </div>
                    <div className="rounded-xl px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">화면 모드</div>
                      <ThemeToggle className="mt-2 w-full" />
                    </div>
                    <Link
                      href="/plans"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-[#344136] transition hover:bg-[var(--brand-accent-soft)] dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span>{admin ? "충전하기" : "요금제 관리"}</span>
                      <span className="text-zinc-400">↗</span>
                    </Link>
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
                className="rounded-xl border border-[#ddd4c7] bg-[#fbf8f2] px-3 py-1.5 text-xs font-black text-[#344136] shadow-[0_8px_18px_rgba(45,57,48,0.06)] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                카카오 로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
