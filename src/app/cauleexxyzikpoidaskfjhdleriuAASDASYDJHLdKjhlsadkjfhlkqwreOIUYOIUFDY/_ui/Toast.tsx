"use client";

// 토스트 — 승인/처리 완료 같은 일시 알림 공용 채널. role=status/alert + aria-live.
//   각 패널의 setNotice/setError 문자열 state 산재 → 공용 push() 로 대체 가능(선택).
//   AdminShell 에 ToastProvider 1회 마운트 → 어디서든 useToast().push(...).

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { cn, FONT, RADIUS, TONE, type Tone } from "./tokens";

type ToastItem = { id: number; tone: Tone; msg: ReactNode };
type PushArgs = { tone?: Tone; msg: ReactNode; ms?: number };
type ToastApi = { push: (args: PushArgs) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let _seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((x) => x.id !== id));
    const t = timers.current[id];
    if (t) {
      clearTimeout(t);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    ({ tone = "blue", msg, ms = 4000 }: PushArgs) => {
      _seq += 1;
      const id = _seq;
      setItems((list) => [...list, { id, tone, msg }]);
      timers.current[id] = setTimeout(() => remove(id), ms);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => {
          const tn = TONE[t.tone];
          const isAlert = t.tone === "rose" || t.tone === "amber";
          return (
            <div
              key={t.id}
              role={isAlert ? "alert" : "status"}
              onClick={() => remove(t.id)}
              className={cn(
                "pointer-events-auto cursor-pointer border font-bold shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
                RADIUS.control,
                "bg-zinc-900 px-4 py-2.5",
                FONT.body,
                tn.border,
                tn.text,
              )}
            >
              {t.msg}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
