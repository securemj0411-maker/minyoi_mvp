"use client";

// Wave 773 (2026-05-27): 사용자 거주 동네 설정 onboarding UI.
//   GPS 버튼 (Kakao reverse geocode) + 수동 dropdown 둘 다 제공.
//   skip 불가 — 당근 매물 거리 제약 때문에 필수.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type RegionOption = {
  daangn_region_id: string;
  daangn_region_name: string;
  daangn_full_path: string;
};

export function HomeRegionOnboarding() {
  const router = useRouter();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "resolving" | "success" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setError("로그인 정보가 없어요"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.push("/login?next=/onboarding/home-region");
        return;
      }
      const res = await fetch("/api/user/home-region?list=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("동네 목록을 불러오지 못했어요");
        return;
      }
      const json = await res.json() as { ok: boolean; regions: RegionOption[] };
      if (cancelled) return;
      setRegions(json.regions ?? []);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const filtered = useMemo(() => {
    if (!search.trim()) return regions.slice(0, 50);
    const q = search.trim().toLowerCase();
    return regions
      .filter((r) =>
        r.daangn_region_name.toLowerCase().includes(q) ||
        r.daangn_full_path.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [regions, search]);

  async function submitWithToken(payload: object) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setError("로그인 정보가 없어요"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.push("/login?next=/onboarding/home-region");
        return;
      }
      const res = await fetch("/api/user/home-region", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "저장 실패");
        return;
      }
      router.push("/explore");
    } finally {
      setBusy(false);
    }
  }

  function handleGpsClick() {
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 기능을 지원하지 않아요");
      return;
    }
    setGpsStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsStatus("resolving");
        await submitWithToken({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("success");
      },
      (err) => {
        setGpsStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setError("위치 권한이 거부됐어요. 동네를 직접 선택해주세요.");
        } else {
          setError("위치를 가져오지 못했어요. 동네를 직접 선택해주세요.");
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function handleManualSelect(region: RegionOption) {
    void submitWithToken({ daangn_region_id: region.daangn_region_id });
  }

  return (
    <div className="mx-auto max-w-md px-5 pt-12 pb-20">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M12 21s7-4.7 7-11a7 7 0 0 0-14 0c0 6.3 7 11 7 11Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <h1 className="mt-5 break-keep text-[26px] font-black leading-[1.18] tracking-tight text-zinc-950 dark:text-zinc-50">
          어디 살고 계세요?
        </h1>
        <p className="mt-3 break-keep text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          당근 매물은 가까운 동네 사람만 채팅이 돼요.
          <br />
          가입한 동네를 알려주시면 가까운 매물 위주로 추천드릴게요.
        </p>

        <button
          type="button"
          onClick={handleGpsClick}
          disabled={busy || gpsStatus === "requesting" || gpsStatus === "resolving"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3182f6] py-4 text-[15px] font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
        >
          {gpsStatus === "requesting" || gpsStatus === "resolving" ? (
            <span>위치 확인 중…</span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              내 위치로 자동 설정
            </>
          )}
        </button>

        <div className="mt-7 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <div className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">
            또는 동네를 직접 입력하세요
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="예) 서초동, 한남동, 다사읍…"
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder-zinc-500"
            disabled={busy}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {regions.length > 0 && (
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-zinc-500">
                매칭되는 동네가 없어요
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.daangn_region_id}
                  type="button"
                  onClick={() => handleManualSelect(r)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 last:border-b-0 dark:border-zinc-800 dark:hover:bg-blue-950/30 dark:active:bg-blue-950/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-black text-zinc-950 dark:text-zinc-50">
                      {r.daangn_region_name}
                    </div>
                    <div className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                      {r.daangn_full_path}
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-zinc-400">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
