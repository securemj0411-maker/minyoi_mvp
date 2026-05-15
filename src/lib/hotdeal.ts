// Wave 93b: 핫딜 큐/디스패치 helper.
// - enqueue: pool에서 차익 큰 매물 찾아 mvp_hotdeal_queue에 insert
// - dispatch: available queue 매물 → claim_next_hotdeal_for_alert RPC → telegram 발송
//
// 정책:
//   - profit_margin >= MIN_PROFIT_MARGIN (default 0.30 = 30%)
//   - band >= 3 (실제 풀 진입 통과)
//   - market_confidence high
//   - lifecycle active
//   - sample 충분 (sku_median > 0)

import { isAdminEmail } from "@/lib/auth-users";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { escapeMd, sendTelegramMessage } from "@/lib/telegram-bot";

export const HOTDEAL_MIN_PROFIT_MARGIN = Number(process.env.HOTDEAL_MIN_PROFIT_MARGIN ?? "0.3");
export const HOTDEAL_MIN_BAND = Number(process.env.HOTDEAL_MIN_BAND ?? "3");
export const HOTDEAL_RESERVE_WINDOW_SECONDS = Number(process.env.HOTDEAL_RESERVE_WINDOW_SECONDS ?? "900"); // 15min default
const HOTDEAL_ENQUEUE_LIMIT = Number(process.env.HOTDEAL_ENQUEUE_LIMIT ?? "100");
const HOTDEAL_DISPATCH_LIMIT = Number(process.env.HOTDEAL_DISPATCH_LIMIT ?? "30");

type CandidateRow = {
  pid: number;
  profit_band: number | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
};

type ListingMeta = {
  pid: number;
  price: number;
  sku_median: number;
  sku_name: string | null;
};

type RawSkuMeta = {
  pid: number;
  sku_id: string | null;
};

export async function enqueueHotdealsFromPool(): Promise<{ scanned: number; enqueued: number; skipped_existing: number }> {
  // candidate_pool 'ready' 매물 (실제 풀 통과) 중 profit_band ≥ MIN_BAND.
  const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,profit_band,comparable_key,expected_profit_min&status=eq.ready&profit_band=gte.${HOTDEAL_MIN_BAND}&order=profit_band.desc,expected_profit_min.desc&limit=${HOTDEAL_ENQUEUE_LIMIT * 3}`;
  const poolRes = await restFetch(poolUrl, { headers: serviceHeaders() });
  if (!poolRes.ok) return { scanned: 0, enqueued: 0, skipped_existing: 0 };
  const poolRows = (await poolRes.json()) as CandidateRow[];
  if (poolRows.length === 0) return { scanned: 0, enqueued: 0, skipped_existing: 0 };

  // mvp_listings 에서 price + sku_median + sku_name. (sku_id 컬럼은 mvp_listings에 없음 — Wave 106 fix)
  const pids = poolRows.map((r) => r.pid);
  const lstRes = await restFetch(
    `${tableUrl("mvp_listings")}?select=pid,price,sku_median,sku_name&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const listings = new Map(((await lstRes.json()) as ListingMeta[]).map((l) => [Number(l.pid), l]));

  // sku_id 는 mvp_raw_listings 에서 보강 (디버깅/통계용. 메시지 본체엔 영향 없음).
  const rawRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,sku_id&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const skuIds = new Map(((await rawRes.json()) as RawSkuMeta[]).map((r) => [Number(r.pid), r.sku_id ?? null]));

  const candidates = poolRows
    .map((p) => {
      const l = listings.get(p.pid);
      if (!l || l.price <= 0 || l.sku_median <= 0) return null;
      const profit_amount = l.sku_median - l.price;
      const profit_margin = profit_amount / l.sku_median;
      return {
        pid: p.pid,
        comparable_key: p.comparable_key,
        sku_id: skuIds.get(p.pid) ?? null,
        sku_name: l.sku_name,
        band: p.profit_band,
        profit_amount,
        profit_margin,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => r.profit_margin >= HOTDEAL_MIN_PROFIT_MARGIN)
    .sort((a, b) => b.profit_margin - a.profit_margin)
    .slice(0, HOTDEAL_ENQUEUE_LIMIT);

  if (candidates.length === 0) return { scanned: poolRows.length, enqueued: 0, skipped_existing: 0 };

  // 이미 queue에 있는 pid 제외.
  const candidatePids = candidates.map((c) => c.pid);
  const existingRes = await restFetch(
    `${tableUrl("mvp_hotdeal_queue")}?select=pid&pid=in.(${candidatePids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const existing = new Set(((await existingRes.json()) as { pid: number }[]).map((r) => Number(r.pid)));
  const fresh = candidates.filter((c) => !existing.has(c.pid));

  if (fresh.length === 0) return { scanned: poolRows.length, enqueued: 0, skipped_existing: existing.size };

  const insertRes = await restFetch(`${tableUrl("mvp_hotdeal_queue")}`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(fresh.map((c) => ({
      pid: c.pid,
      comparable_key: c.comparable_key,
      profit_margin: Math.round(c.profit_margin * 10000) / 10000,
      profit_amount: c.profit_amount,
      sku_id: c.sku_id,
      sku_name: c.sku_name,
      band: c.band,
      status: "available",
    }))),
  });
  if (!insertRes.ok) {
    return { scanned: poolRows.length, enqueued: 0, skipped_existing: existing.size };
  }
  return { scanned: poolRows.length, enqueued: fresh.length, skipped_existing: existing.size };
}

type ClaimResultRaw = {
  out_reservation_id: number;
  out_user_ref: string;
  out_chat_id: number;
  out_attempt_no: number;
  out_expires_at: string;
};
type ClaimResult = {
  reservation_id: number;
  user_ref: string;
  chat_id: number;
  attempt_no: number;
  expires_at: string;
};

export async function dispatchAvailableHotdeals(): Promise<{ claimed: number; sent: number; failed: number; admin_shadowed: number }> {
  // Wave 106: TTL 만료된 pending reservation 정리 + queue.status='reserved' → 'available' 복원.
  // 사용자가 응답 안 한 매물이 다음 사용자에게 자동 reroute되도록 best-effort 호출.
  await restFetch(rpcUrl("expire_stale_hotdeal_reservations"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({}),
  }).catch(() => undefined);

  // available queue 가져오기.
  const queueRes = await restFetch(
    `${tableUrl("mvp_hotdeal_queue")}?select=pid,sku_name,profit_margin,profit_amount,band&status=eq.available&order=profit_margin.desc&limit=${HOTDEAL_DISPATCH_LIMIT}`,
    { headers: serviceHeaders() },
  );
  if (!queueRes.ok) return { claimed: 0, sent: 0, failed: 0, admin_shadowed: 0 };
  const queue = (await queueRes.json()) as Array<{
    pid: number;
    sku_name: string | null;
    profit_margin: number;
    profit_amount: number;
    band: number | null;
  }>;

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let adminShadowed = 0;

  // listing 정보 lookup (pid → name/price/sku_median).
  const pids = queue.map((q) => q.pid);
  const listingsByPid = pids.length === 0
    ? new Map<number, { name: string; price: number; sku_median: number }>()
    : await fetchListingMeta(pids);

  for (const item of queue) {
    const claim = await claimNext(item.pid);
    if (!claim) continue;
    claimed += 1;

    const meta = listingsByPid.get(item.pid) ?? { name: item.sku_name ?? "(no title)", price: 0, sku_median: 0 };
    const result = await sendHotdealAlert(claim.chat_id, item.pid, {
      title: meta.name,
      price: meta.price,
      skuMedian: meta.sku_median,
      profitAmount: item.profit_amount,
      profitMargin: item.profit_margin,
      band: item.band,
      expiresAt: claim.expires_at,
    });
    if (result.ok) {
      sent += 1;
      await markReservationSent(claim.reservation_id, true, null);
    } else {
      failed += 1;
      // Wave 106: telegram API description 보존 (이전엔 모든 실패가 "telegram_send_failed" 일괄 박힘 → 디버그 불가능).
      console.warn("[hotdeal dispatch] telegram fail", { pid: item.pid, chat_id: claim.chat_id, description: result.description });
      await markReservationSent(claim.reservation_id, false, result.description?.slice(0, 200) ?? "telegram_send_failed");
    }

    // Admin shadow: 운영자한테도 동일 알림 (selected 사용자 X일 때만 — 본인이 selected면 중복 X).
    adminShadowed += await sendAdminShadow(claim.user_ref, item.pid, {
      title: meta.name,
      price: meta.price,
      skuMedian: meta.sku_median,
      profitAmount: item.profit_amount,
      profitMargin: item.profit_margin,
      band: item.band,
      expiresAt: claim.expires_at,
      selectedUserRef: claim.user_ref,
    });
  }

  return { claimed, sent, failed, admin_shadowed: adminShadowed };
}

async function claimNext(pid: number): Promise<ClaimResult | null> {
  const res = await restFetch(rpcUrl("claim_next_hotdeal_for_alert"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({ p_pid: pid, p_window_seconds: HOTDEAL_RESERVE_WINDOW_SECONDS }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ClaimResultRaw[];
  const r = rows[0];
  if (!r) return null;
  return {
    reservation_id: r.out_reservation_id,
    user_ref: r.out_user_ref,
    chat_id: r.out_chat_id,
    attempt_no: r.out_attempt_no,
    expires_at: r.out_expires_at,
  };
}

async function fetchListingMeta(pids: number[]) {
  const res = await restFetch(
    `${tableUrl("mvp_listings")}?select=pid,name,price,sku_median&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ pid: number; name: string; price: number; sku_median: number }>;
  return new Map(rows.map((r) => [Number(r.pid), { name: r.name ?? "(no title)", price: Number(r.price), sku_median: Number(r.sku_median) }]));
}

type AlertContent = {
  title: string;
  price: number;
  skuMedian: number;
  profitAmount: number;
  profitMargin: number;
  band: number | null;
  expiresAt: string;
};

function buildAlertText(pid: number, c: AlertContent, opts: { adminShadow?: boolean; selectedHint?: string } = {}): string {
  // 일반 사용자: teaser만 (차익 정도 + 만료시간). 매물 정보는 미뇨이에서 "열기" 후 공개.
  // admin shadow: 전체 정보 (감시 목적이라 노출 OK).
  const profitWan = Math.round(c.profitAmount / 10000);
  const pct = Math.round(c.profitMargin * 100);
  const expires = new Date(c.expiresAt);
  const minLeft = Math.max(0, Math.round((expires.getTime() - Date.now()) / 60000));

  if (opts.adminShadow) {
    const priceWan = Math.round(c.price / 10000);
    const marketWan = Math.round(c.skuMedian / 10000);
    const safeName = escapeMd(c.title.slice(0, 80));
    return [
      "👁 *\\[ADMIN SHADOW\\]*",
      `*${safeName}*`,
      "",
      `매입가  · ${escapeMd(`₩${priceWan.toLocaleString("ko-KR")}만`)}`,
      `시세    · ${escapeMd(`₩${marketWan.toLocaleString("ko-KR")}만`)}`,
      `차익    · *${escapeMd(`₩${profitWan.toLocaleString("ko-KR")}만 (${pct}%)`)}*`,
      c.band !== null ? `band    · ${c.band}` : "",
      opts.selectedHint ? `_선출: ${escapeMd(opts.selectedHint)}_` : "",
      `⏱ ${minLeft}분`,
    ].filter(Boolean).join("\n");
  }

  return [
    "🔥 *핫딜 매물 도착*",
    "",
    `차익  · *${escapeMd(`₩${profitWan.toLocaleString("ko-KR")}만 (${pct}%)`)}*`,
    c.band !== null ? `band  · ${c.band}` : "",
    "",
    `⏱ ${minLeft}분 안에 미뇨이에서 *열어* 매물 확인`,
  ].filter(Boolean).join("\n");
}

function buildAlertReplyMarkup(pid: number) {
  return {
    inline_keyboard: [[{
      text: "🔍 미뇨이에서 열기",
      url: `${process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app"}/me?view=hotdeal-alerts&pid=${pid}`,
    }]],
  };
}

async function sendHotdealAlert(chatId: number, pid: number, content: AlertContent): Promise<{ ok: boolean; description: string | null }> {
  const text = buildAlertText(pid, content);
  const res = await sendTelegramMessage(chatId, text, {
    parseMode: "MarkdownV2",
    replyMarkup: buildAlertReplyMarkup(pid),
  });
  return { ok: res.ok, description: res.ok ? null : (res.description ?? "unknown_telegram_error") };
}

async function markReservationSent(id: number, ok: boolean, error: string | null) {
  await restFetch(
    `${tableUrl("mvp_hotdeal_reservations")}?id=eq.${id}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        notification_sent: ok,
        notification_error: error,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

// Admin shadow — 모든 admin 사용자(텔레그램 연결됨)한테 복사 발송.
// selected 사용자 본인이 admin이면 중복 X.
async function sendAdminShadow(selectedUserRef: string, pid: number, content: AlertContent & { selectedUserRef: string }): Promise<number> {
  // admin은 모든 핫딜 alert를 [ADMIN SHADOW] 사본으로 받음 (선출 여부 무관).
  // 선출된 본인이 admin이면 user-format(teaser)와 admin shadow(full detail) 둘 다 받음 — 의도된 동작 (운영자 감시).
  const { data: usersRes } = await fetchAdminTelegramTargets();
  let count = 0;
  for (const target of usersRes) {
    const isSelf = target.user_ref === selectedUserRef;
    const ok = await sendTelegramMessage(target.chat_id, buildAlertText(pid, content, {
      adminShadow: true,
      selectedHint: isSelf ? "본인 선출됨" : `user_ref=${selectedUserRef.slice(0, 8)}…`,
    }), {
      parseMode: "MarkdownV2",
      replyMarkup: buildAlertReplyMarkup(pid),
    });
    if (ok.ok) {
      count += 1;
    } else {
      // Wave 106: admin shadow 실패도 로그 (이전엔 silent — 운영자 본인 텔레그램 끊겨도 모름).
      console.warn("[hotdeal admin shadow] telegram fail", { pid, chat_id: target.chat_id, description: ok.description });
    }
  }
  return count;
}

async function fetchAdminTelegramTargets(): Promise<{ data: Array<{ user_ref: string; chat_id: number; email: string | null }> }> {
  // mvp_telegram_bindings의 auth_user_id로 supabase auth admin API로 email 조회 → admin email 일치하면 shadow target.
  const tgRes = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?select=user_ref,chat_id,auth_user_id&chat_id=not.is.null&paused=eq.false`,
    { headers: serviceHeaders() },
  );
  if (!tgRes.ok) return { data: [] };
  const bindings = (await tgRes.json()) as Array<{ user_ref: string; chat_id: number; auth_user_id: string }>;
  if (bindings.length === 0) return { data: [] };

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) return { data: [] };

  const targets: Array<{ user_ref: string; chat_id: number; email: string | null }> = [];
  for (const b of bindings) {
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/admin/users/${b.auth_user_id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!r.ok) continue;
      const data = (await r.json().catch(() => ({}))) as { email?: string };
      const email = data.email ?? null;
      if (isAdminEmail(email)) targets.push({ user_ref: b.user_ref, chat_id: b.chat_id, email });
    } catch {
      // ignore
    }
  }
  return { data: targets };
}
