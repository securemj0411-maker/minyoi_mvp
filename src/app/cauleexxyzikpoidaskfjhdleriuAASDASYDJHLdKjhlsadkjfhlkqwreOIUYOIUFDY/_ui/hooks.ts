"use client";

// 공용 클라이언트 훅 — 각 패널의 setInterval(4벌)/setTick/모달 키핸들 재구현을 1곳으로.
//   간격값은 호출부가 그대로 넘김(5s/5s/10s/30s 의도 유지) — 메커니즘만 통일.

import { useEffect, useRef, useState, type RefObject } from "react";

import { fmtKst, secondsUntil } from "./format";

/** ms 주기로 fn 호출. 숨김 탭에선 pause, 복귀 시 1회 즉시 갱신. immediate(기본 true)·enabled(기본 true). */
export function usePolling(
  fn: () => void | Promise<void>,
  ms: number,
  opts?: { immediate?: boolean; enabled?: boolean },
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const enabled = opts?.enabled !== false;
  const immediate = opts?.immediate !== false;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const run = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fnRef.current();
    };
    if (immediate) void fnRef.current();
    const id = window.setInterval(run, ms);
    const onVis = () => {
      if (document.visibilityState === "visible") void fnRef.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled, immediate]);
}

/** ISO 시각까지 남은 초. 1초마다 재렌더. null 이면 0. */
export function useCountdown(iso: string | null | undefined): number {
  const [sec, setSec] = useState<number>(() => (iso ? secondsUntil(iso) : 0));
  useEffect(() => {
    if (!iso) {
      setSec(0);
      return;
    }
    setSec(secondsUntil(iso));
    const id = window.setInterval(() => setSec(secondsUntil(iso)), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  return sec;
}

/** KST 시계 문자열, 1초 tick. 기본 "YY.MM.DD HH:mm:ss". */
export function useKstClock(opts?: { seconds?: boolean }): string {
  const seconds = opts?.seconds !== false;
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const upd = () => setNow(fmtKst(new Date(), { seconds }));
    upd();
    const id = window.setInterval(upd, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return now;
}

/**
 * 모달/드로어 공용 a11y: 열렸을 때 Escape 닫기 + Tab focus-trap + 첫 포커스 + 닫힐 때 직전 포커스 복원 + body scroll lock.
 * Modal/Drawer 가 공유 — 손수짠 role=dialog(Escape/trap 없던) 대체.
 */
export function useDialogA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  ref: RefObject<T | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    const prevFocus = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;

    const focusables = (): HTMLElement[] => {
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const first = focusables()[0];
    (first ?? root)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) {
          e.preventDefault();
          root?.focus?.();
          return;
        }
        const active = document.activeElement as HTMLElement | null;
        const idx = active ? f.indexOf(active) : -1;
        if (e.shiftKey && idx <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && idx === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose, ref]);
}
