"use client";

// Wave 159 (2026-05-17): admin 전용 listing_type 분류 검증 view.
// 운영자가 accessory/parts/damaged 등 차단된 매물을 확인 + false positive 발견 시 override 박음.

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Item = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  bunjangUrl: string;
  skuId: string | null;
  skuName: string | null;
  listingType: string;
  listingTypeOverride: string | null;
  listingTypeOverrideBy: string | null;
  listingTypeOverrideAt: string | null;
  listingTypeOverrideReason: string | null;
  bunjangConditionLabel: string | null;
  numComment: number;
  qty: number;
  descriptionPreview: string;
  detailEnrichedAt: string | null;
  lastSeenAt: string | null;
  comparableKey: string | null;
  conditionClass: string | null;
  parseConfidence: number | null;
  needsReview: boolean;
  aiListingType: string | null;
  aiReason: string | null;
  aiConfidence: number | null;
  aiRiskKeywords: string[] | null;
  aiClassifiedAt: string | null;
  hasComment: boolean;
  commentPreview: string;
  commentUpdatedAt: string | null;
};

type Resp = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: Item[];
};

const krw = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;

function relAge(iso: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

const TYPE_OPTIONS = [
  { v: "accessory", label: "accessory (액세서리)" },
  { v: "unknown", label: "unknown (미분류)" },
  { v: "parts", label: "parts (부품/한쪽)" },
  { v: "damaged", label: "damaged (손상/하자)" },
  { v: "callout", label: "callout (호객/판매홍보)" },
  { v: "buying", label: "buying (구매희망)" },
  { v: "commercial", label: "commercial (도매업자)" },
  { v: "multi", label: "multi (다중매물 묶음)" },
  { v: "normal", label: "normal (정상)" },
];

export default function AdminClassificationBrowser() {
  const [listingType, setListingType] = useState("accessory");
  const [page, setPage] = useState(1);
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideBusy, setOverrideBusy] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        listing_type: listingType,
        page: String(page),
        pageSize: "20",
      });
      if (onlyOverridden) params.set("only_overridden", "1");
      const r = await fetch(`/api/admin/classification-listings?${params.toString()}`);
      if (!r.ok) {
        setData(null);
        return;
      }
      const json = (await r.json()) as Resp;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [listingType, page, onlyOverridden]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleOverride = async (pid: number, override: string | null) => {
    const reason = override
      ? prompt(`사유 (200자 이내): ${override}로 override`) ?? ""
      : "";
    setOverrideBusy(pid);
    try {
      const r = await fetch("/api/admin/listing-type-override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pid, override, reason }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(`override 실패: ${(j as { error?: string }).error ?? r.status}`);
        return;
      }
      const j = (await r.json()) as { skuRecalculated?: string | null; override?: string | null };
      if (j.override === "normal" && j.skuRecalculated == null) {
        alert("⚠️ catalog 매칭 실패 — sku_id 재계산 안 됨. 풀 진입 안 함. catalog.ts에 SKU 등록 필요.");
      }
      await fetchData();
    } finally {
      setOverrideBusy(null);
    }
  };

  return (
    <section className="px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-4 rounded-[24px] border border-[#e2d9cb] bg-[#fffaf6] p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-xl font-black tracking-tight text-[#223127] dark:text-white">
          분류 검증 (운영자)
        </h2>
        <p className="mt-1 text-xs font-semibold text-[#687366] dark:text-zinc-400">
          AI/regex가 분류한 listing_type 매물을 검증. false positive 발견 시 본품으로 override.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={listingType}
            onChange={(e) => {
              setListingType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#223127] dark:text-zinc-200">
            <input
              type="checkbox"
              checked={onlyOverridden}
              onChange={(e) => {
                setOnlyOverridden(e.target.checked);
                setPage(1);
              }}
            />
            override 박힌 것만
          </label>
          {data && (
            <span className="text-xs font-bold text-[#687366] dark:text-zinc-400">
              {data.total.toLocaleString("ko-KR")}건
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-zinc-500">불러오는 중…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center text-sm text-zinc-500">매물 없음</div>
      ) : (
        <>
          <div className="grid gap-2">
            {data.items.map((item) => (
              <div
                key={item.pid}
                className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt=""
                    width={100}
                    height={100}
                    className="h-[100px] w-[100px] shrink-0 rounded object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-[100px] w-[100px] shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                  <div className="line-clamp-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900 dark:text-red-200">
                      {item.listingType}
                    </span>
                    {item.listingTypeOverride && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        override → {item.listingTypeOverride}
                      </span>
                    )}
                    {item.conditionClass && (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {item.conditionClass}
                      </span>
                    )}
                    {item.skuName && (
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                        {item.skuName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-zinc-700 dark:text-zinc-300">
                    <span>{krw(item.price)}</span>
                    {item.bunjangConditionLabel && <span>· {item.bunjangConditionLabel}</span>}
                    {item.numComment > 0 && <span>· 댓글 {item.numComment}</span>}
                    {item.qty > 1 && <span>· 수량 {item.qty}</span>}
                    <span>· {relAge(item.lastSeenAt)}</span>
                  </div>
                  {item.aiReason && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      AI: {item.aiReason}
                    </div>
                  )}
                  {item.comparableKey && (
                    <div className="truncate text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {item.comparableKey}
                    </div>
                  )}
                  {item.descriptionPreview && (
                    <div className="line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {item.descriptionPreview}
                    </div>
                  )}
                  {item.hasComment && (
                    <div className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      💬 {item.commentPreview}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={item.bunjangUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      번장 열기
                    </a>
                    {!item.listingTypeOverride && (
                      <button
                        type="button"
                        disabled={overrideBusy === item.pid}
                        onClick={() => handleOverride(item.pid, "normal")}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        본품 override
                      </button>
                    )}
                    {item.listingTypeOverride && (
                      <button
                        type="button"
                        disabled={overrideBusy === item.pid}
                        onClick={() => handleOverride(item.pid, null)}
                        className="rounded-lg bg-zinc-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        override 해제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
              >
                이전
              </button>
              <span className="font-bold">
                {page} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
