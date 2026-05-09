"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ResetState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function DebugResetPanel() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<ResetState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const canReset = confirm === "RESET" && secret.trim().length > 0 && !isPending;

  async function resetDb() {
    if (!canReset) return;
    setState({ status: "idle" });

    const res = await fetch("/api/debug/reset-db", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm, secret: secret.trim() }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; cleared?: string[] } | null;

    if (!res.ok || !data?.ok) {
      setState({ status: "error", message: data?.error ?? `초기화 실패 (${res.status})` });
      return;
    }

    setConfirm("");
    setSecret("");
    setState({
      status: "success",
      message: `${data.cleared?.length ?? 0}개 운영 테이블을 비웠습니다. 다음 tick부터 새 데이터로 다시 쌓입니다.`,
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-md border border-red-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-red-800">개발용 DB 초기화</div>
          <div className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            후보, 원본 매물, 상세 큐, 수집 로그, AI 판정 캐시만 비웁니다. 카탈로그, 마이닝 산출물, 하드코딩된 룰은 유지됩니다.
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[130px_180px_120px]">
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="RESET"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
          />
          <input
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="CRON_SECRET"
            type="password"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
          />
          <button
            type="button"
            onClick={resetDb}
            disabled={!canReset}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isPending ? "초기화 중" : "전부 비우기"}
          </button>
        </div>
      </div>
      {state.status !== "idle" ? (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
