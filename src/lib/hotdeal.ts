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
  sku_id: string | null;
  sku_name: string | null;
};

export async function enqueueHotdealsFromPool(): Promise<{ scanned: number; enqueued: number; skipped_existing: number }> {
  // candidate_pool 'ready' 매물 (실제 풀 통과) 중 profit_band ≥ MIN_BAND.
  const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,profit_band,comparable_key,expected_profit_min&status=eq.ready&profit_band=gte.${HOTDEAL_MIN_BAND}&order=profit_band.desc,expected_profit_min.desc&limit=${HOTDEAL_ENQUEUE_LIMIT * 3}`;
  const poolRes = await restFetch(poolUrl, { headers: serviceHeaders() });
  if (!poolRes.ok) return { scanned: 0, enqueued: 0, skipped_existing: 0 };
  const poolRows = (await poolRes.json()) as CandidateRow[];
  if (poolRows.length === 0) return { scanned: 0, enqueued: 0, skipped_existing: 0 };

  // mvp_listings에서 price + sku_median + sku_name lookup.
  const pids = poolRows.map((r) => r.pid);
  const lstRes = await restFetch(
    `${tableUrl("mvp_listings")}?select=pid,price,sku_median,sku_id,sku_name&pid=in.(${pids.join(",")})`,
    { headers: serviceHeaders() },
  );
  const listings = new Map(((await lstRes.json()) as ListingMeta[]).map((l) => [Number(l.pid), l]));

  const candidates = poolRows
    .map((p) => {
      const l = listings.get(p.pid);
      if (!l || l.price <= 0 || l.sku_median <= 0) return null;
      const profit_amount = l.sku_median - l.price;
      const profit_margin = profit_amount / l.sku_median;
      return {
        pid: p.pid,
        comparable_key: p.comparable_key,
        sku_id: l.sku_id,
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

type ClaimResult = {
  reservation_id: number;
  user_ref: string;
  chat_id: number;
  attempt_no: number;
  expires_at: string;
};

export async function dispatchAvailableHotdeals(): Promise<{ claimed: number; sent: number; failed: number; admin_shadowed: number }> {
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
    const ok = await sendHotdealAlert(claim.chat_id, item.pid, {
      title: meta.name,
      price: meta.price,
      skuMedian: meta.sku_median,
      profitAmount: item.profit_amount,
      profitMargin: item.profit_margin,
      band: item.band,
      expiresAt: claim.expires_at,
    });
    if (ok) {
      sent += 1;
      await markReservationSent(claim.reservation_id, true, null);
    } else {
      failed += 1;
      await markReservationSent(claim.reservation_id, false, "telegram_send_failed");
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
  const rows = (await res.json()) as ClaimResult[];
  return rows[0] ?? null;
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
  const profitWan = Math.round(c.profitAmount / 10000);
  const priceWan = Math.round(c.price / 10000);
  const marketWan = Math.round(c.skuMedian / 10000);
  const pct = Math.round(c.profitMargin * 100);
  const expires = new Date(c.expiresAt);
  const minLeft = Math.max(0, Math.round((expires.getTime() - Date.now()) / 60000));
  const safeName = escapeMd(c.title.slice(0, 80));
  const lines = [
    opts.adminShadow ? "👁 *\\[ADMIN SHADOW\\]*" : "🔥 *핫딜 매물*",
    `*${safeName}*`,
    "",
    `매입가  · ${escapeMd(`₩${priceWan.toLocaleString("ko-KR")}만`)}`,
    `시세    · ${escapeMd(`₩${marketWan.toLocaleString("ko-KR")}만`)}`,
    `차익    · *${escapeMd(`₩${profitWan.toLocaleString("ko-KR")}만 (${pct}%)`)}*`,
    c.band !== null ? `band    · ${c.band}` : "",
    "",
    opts.selectedHint ? `_선출: ${escapeMd(opts.selectedHint)}_` : "",
    `⏱ ${minLeft}분 안에 응답`,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildAlertReplyMarkup(pid: number) {
  return {
    inline_keyboard: [[{
      text: "🔍 미뇨이에서 열기",
      url: `${process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app"}/me?view=hotdeal-alerts&pid=${pid}`,
    }]],
  };
}

async function sendHotdealAlert(chatId: number, pid: number, content: AlertContent): Promise<boolean> {
  const text = buildAlertText(pid, content);
  const res = await sendTelegramMessage(chatId, text, {
    parseMode: "MarkdownV2",
    replyMarkup: buildAlertReplyMarkup(pid),
  });
  return res.ok;
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
  // admin email로 user 찾기 → user_ref → telegram chat_id.
  // mvp_user_credits에 auth_user_id가 있으니 거기서 join. 또는 mvp_telegram_bindings의 auth_user_id로 admin check 필요.
  // 단순화: telegram_bindings 전체 가져와서 코드에서 admin email check.
  const { data: usersRes } = await fetchAdminTelegramTargets();
  let count = 0;
  for (const target of usersRes) {
    if (target.user_ref === selectedUserRef) continue; // 본인 중복 방지
    const ok = await sendTelegramMessage(target.chat_id, buildAlertText(pid, content, {
      adminShadow: true,
      selectedHint: `user_ref=${selectedUserRef.slice(0, 8)}…`,
    }), {
      parseMode: "MarkdownV2",
      replyMarkup: buildAlertReplyMarkup(pid),
    });
    if (ok.ok) count += 1;
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
