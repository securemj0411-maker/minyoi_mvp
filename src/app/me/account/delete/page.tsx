// Wave 106: 회원 탈퇴 페이지 — 별도 페이지로 분리해 실수 방지.
// 사용자가 confirm 텍스트 ("탈퇴") 정확히 입력해야만 button enabled.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const REQUIRED_CONFIRM = "탈퇴";

export default function AccountDeletePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setAuthChecked(true); return; }
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setIsAuthed(Boolean(data.user));
      setAuthChecked(true);
    }).catch(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  async function handleDelete() {
    if (confirmText !== REQUIRED_CONFIRM) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "탈퇴 처리에 실패했어요.");
        setBusy(false);
        return;
      }
      setDoneMessage(data.message ?? "회원 탈퇴가 완료됐어요.");
      const supabase = getSupabaseBrowserClient();
      try { if (supabase) await supabase.auth.signOut(); } catch {}
      setTimeout(() => router.push("/"), 2500);
    } catch {
      setError("네트워크 오류로 탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-xl text-sm font-bold text-[#5a6658]">확인 중…</div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-black text-[#223127] dark:text-zinc-100">로그인이 필요해요</h1>
          <p className="mt-2 text-sm font-semibold text-[#5a6658] dark:text-zinc-400">회원 탈퇴는 로그인 후 진행할 수 있어요.</p>
          <Link href="/login" className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#314238] px-4 text-sm font-black text-[#f7f1e6]">
            로그인하기
          </Link>
        </div>
      </main>
    );
  }

  if (doneMessage) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h1 className="text-xl font-black text-emerald-900 dark:text-emerald-100">탈퇴 완료</h1>
          <p className="mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">{doneMessage}</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">잠시 후 메인으로 이동합니다…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/me" className="inline-flex text-xs font-bold text-[#5a6658] hover:text-[#223127] dark:text-zinc-400">← 대시보드로</Link>

        <header>
          <h1 className="text-2xl font-black text-[#223127] dark:text-zinc-100 sm:text-3xl">회원 탈퇴</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            정말 탈퇴하시겠어요? 아래 내용 확인 후 진행해주세요.
          </p>
        </header>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
          <h2 className="text-sm font-black text-red-900 dark:text-red-200">⚠️ 탈퇴 시 일어나는 일</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-6 text-red-900 dark:text-red-200">
            <li>로그인 정보, 텔레그램 연결, 크레딧 잔액, 구독 플랜 — 모두 즉시 삭제됩니다.</li>
            <li>지난 추천 기록·결제 내역은 통계 보존을 위해 <strong>익명화</strong>됩니다 (개인 식별 X).</li>
            <li>현재 활성 구독은 자동으로 종료되며, 남은 기간 환불은 없습니다.</li>
            <li>같은 카카오 계정으로 다시 가입하면 새 사용자로 시작합니다 (이전 데이터 복구 X).</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-black text-[#223127] dark:text-zinc-100">
            확인 — 아래 입력란에 <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800 dark:bg-red-950/60 dark:text-red-200">{REQUIRED_CONFIRM}</code> 정확히 입력
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={REQUIRED_CONFIRM}
            className="mt-2 w-full rounded-lg border border-[#ddd4c7] bg-white px-3 py-2 text-sm font-bold text-[#223127] outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            autoComplete="off"
            disabled={busy}
          />

          {error ? (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Link href="/me" className="inline-flex h-10 items-center rounded-lg border border-[#ddd4c7] px-4 text-sm font-bold text-[#556252] transition hover:bg-[#f5ede0] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              취소
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || confirmText !== REQUIRED_CONFIRM}
              className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "처리 중…" : "회원 탈퇴 진행"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
