"use client";

// Wave 773 (2026-05-27): 사용자 거주 동네 설정 onboarding UI.
//   GPS 버튼 (Kakao reverse geocode) + 수동 검색 (Kakao address API) 둘 다 제공.
//   skip 불가 — 당근 매물 거리 제약 때문에 필수.
// Wave 886.4 (2026-05-27): 218-entry 로컬 리스트 → 카카오 주소 검색 API로 교체.
//   "상도동" 같은 동 검색 가능 (전국 동 커버).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AddressOption = {
  fullPath: string;
  region1: string;
  region2: string;
  region3: string;
  lat: number;
  lng: number;
};

export function HomeRegionOnboarding() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AddressOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "resolving" | "preview" | "saving" | "success" | "error">("idle");
  const [confirmedRegion, setConfirmedRegion] = useState<{ fullPath: string; name: string } | null>(null);
  // Wave 886.9: GPS 결과 미리보기 (저장 전 사용자 확인용).
  const [gpsPreview, setGpsPreview] = useState<{ fullPath: string; region1: string; region2: string; region3: string; lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
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
      const res = await fetch(`/api/user/home-region/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (q !== lastQueryRef.current) return; // stale response
      const json = (await res.json()) as { ok: boolean; results?: AddressOption[]; error?: string };
      if (!json.ok) {
        setError(json.error === "KAKAO_REST_API_KEY missing" ? "주소 검색 키가 설정되지 않았어요" : "검색 실패");
        setResults([]);
        return;
      }
      setResults(json.results ?? []);
    } catch {
      setError("검색 중 오류");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [router]);

  useEffect(() => {
    lastQueryRef.current = search;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, runSearch]);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-minyoi-user-action": "1" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as {
        ok: boolean;
        error?: string;
        home_region?: { daangn_region_name?: string | null; daangn_full_path?: string | null };
      };
      if (!res.ok || !json.ok) {
        setError(json.error || "저장 실패");
        return;
      }
      // Wave 886.6 (2026-05-27): 확정된 동네 1초 노출 후 navigate.
      //   GPS 자동 설정한 사용자도 "어디로 설정됐는지" 알고 넘어감.
      const fullPath = json.home_region?.daangn_full_path ?? "";
      const name = json.home_region?.daangn_region_name ?? "";
      if (fullPath || name) {
        setConfirmedRegion({ fullPath, name });
        // Wave 801 (2026-05-30): 동네 확정 노출 시간 (1.1s) 동안 메인 피드 prefetch.
        //   /me 진입 시 ExploreClient 가 같은 endpoint fetch — server-side DB 가 warm
        //   (cache: no-store 라 응답은 재사용 안 하지만 PG buffer + 거리 계산 캐시 효과).
        //   fire-and-forget — 실패해도 redirect 진행. 토큰 같이 박아 인증 통과.
        const prefetchHeaders = { Authorization: `Bearer ${token}` } as const;
        void fetch("/api/packs/pool", { cache: "no-store", headers: prefetchHeaders }).catch(() => undefined);
        void fetch("/api/stats/pool", { cache: "no-store", headers: prefetchHeaders }).catch(() => undefined);
        await new Promise<void>((r) => setTimeout(r, 1100));
      }
      // Wave 886.5 (2026-05-27): 기존 "/explore" 라우트는 존재 X (404) → "/me" 로 redirect.
      router.push("/me");
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
    // Wave 886.9: enableHighAccuracy=true — 동 단위 정확도 ↑ (GPS hw 우선, wifi/cell triangulation fallback).
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsStatus("resolving");
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // 저장 X, reverse-geocode 결과만 받아서 사용자 확인 받기.
        try {
          const supabase = getSupabaseBrowserClient();
          if (!supabase) { setError("로그인 정보가 없어요"); setGpsStatus("error"); return; }
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) { router.push("/login?next=/onboarding/home-region"); return; }
          const res = await fetch(`/api/user/home-region/reverse-geocode?lat=${lat}&lng=${lng}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = (await res.json()) as {
            ok: boolean;
            fullPath?: string;
            region1?: string; region2?: string; region3?: string;
            lat?: number; lng?: number;
            error?: string;
          };
          if (!json.ok || !json.fullPath) {
            setGpsStatus("error");
            setError(json.error === "KAKAO_REST_API_KEY missing" ? "주소 변환 키가 설정되지 않았어요" : "위치 변환 실패. 동네를 직접 입력해주세요.");
            return;
          }
          setGpsPreview({
            fullPath: json.fullPath,
            region1: json.region1 ?? "",
            region2: json.region2 ?? "",
            region3: json.region3 ?? "",
            lat,
            lng,
          });
          setGpsStatus("preview");
        } catch {
          setGpsStatus("error");
          setError("위치 변환 중 오류. 동네를 직접 입력해주세요.");
        }
      },
      (err) => {
        setGpsStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setError("위치 권한이 거부됐어요. 동네를 직접 입력해주세요.");
        } else {
          setError("위치를 가져오지 못했어요. 동네를 직접 입력해주세요.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  }

  function handleGpsConfirm() {
    if (!gpsPreview) return;
    setGpsStatus("saving");
    void submitWithToken({ lat: gpsPreview.lat, lng: gpsPreview.lng, fullPath: gpsPreview.fullPath });
  }

  function handleGpsReject() {
    setGpsPreview(null);
    setGpsStatus("idle");
    setError(null);
  }

  function handleAddressPick(addr: AddressOption) {
    // Wave 886.4: 카카오 주소 검색 결과의 lat/lng를 기존 GPS 경로로 전달.
    // Wave 887: 사용자가 고른 주소 fullPath 를 같이 보내 저장 완료 토스트가 다른 동으로 바뀌지 않게 한다.
    void submitWithToken({ lat: addr.lat, lng: addr.lng, fullPath: addr.fullPath });
  }

  const trimmed = search.trim();
  const showEmptyHint = trimmed.length > 0 && trimmed.length < 2;
  const showNoResults = trimmed.length >= 2 && !searching && results.length === 0;

  return (
    <div className="mx-auto max-w-md px-5 pt-12 pb-20">
      {confirmedRegion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/55 backdrop-blur-sm">
          <div className="mx-5 flex max-w-sm flex-col items-center rounded-3xl bg-white px-7 py-8 shadow-2xl ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="mt-4 text-[13px] font-bold text-zinc-500 dark:text-zinc-400">
              동네 설정 완료
            </div>
            <div className="mt-1.5 break-keep text-center text-[19px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
              {confirmedRegion.fullPath || confirmedRegion.name}
            </div>
            <div className="mt-3 text-[12px] text-zinc-500 dark:text-zinc-400">
              잠시 후 매물 피드로 이동해요
            </div>
          </div>
        </div>
      )}
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

        {(gpsStatus === "preview" || gpsStatus === "saving") && gpsPreview ? (
          <div className="mt-6 rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="text-[12px] font-bold text-blue-700 dark:text-blue-300">
              📍 이 위치 맞아요?
            </div>
            <div className="mt-1.5 break-keep text-[18px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
              {gpsPreview.fullPath}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              GPS는 가끔 옆 동을 잡아요. 다르면 아래에서 직접 입력 ↓
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGpsReject}
                disabled={busy}
                className="rounded-xl border border-zinc-200 bg-white py-3 text-[14px] font-bold text-zinc-700 transition active:scale-[0.98] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                다른 동네
              </button>
              <button
                type="button"
                onClick={handleGpsConfirm}
                disabled={busy || gpsStatus === "saving"}
                className="rounded-xl bg-[#3182f6] py-3 text-[14px] font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
              >
                {gpsStatus === "saving" ? "저장 중…" : "맞아요"}
              </button>
            </div>
          </div>
        ) : (
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
        )}

        <div className="mt-7 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <div className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">
            또는 동네를 직접 입력하세요
          </div>
          <div className="relative mt-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="예) 상도동, 서초동, 동작구…"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 pr-10 text-[15px] text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder-zinc-500"
              disabled={busy}
              autoComplete="off"
            />
            {searching && (
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
              </div>
            )}
          </div>
          {showEmptyHint && (
            <div className="mt-2 text-[11px] text-zinc-500">2글자 이상 입력해주세요</div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            {results.map((r, idx) => (
              <button
                key={`${r.fullPath}-${idx}`}
                type="button"
                onClick={() => handleAddressPick(r)}
                disabled={busy}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 last:border-b-0 dark:border-zinc-800 dark:hover:bg-blue-950/30 dark:active:bg-blue-950/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-black text-zinc-950 dark:text-zinc-50">
                    {r.region3 || r.region2 || r.fullPath}
                  </div>
                  <div className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                    {r.fullPath}
                  </div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-zinc-400">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        )}
        {showNoResults && (
          <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-6 text-center text-[13px] text-zinc-500 dark:bg-zinc-950">
            매칭되는 동네가 없어요. 다른 키워드로 검색해보세요.
          </div>
        )}
      </div>
    </div>
  );
}
