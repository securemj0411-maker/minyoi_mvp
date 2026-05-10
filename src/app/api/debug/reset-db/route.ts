import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const RUNTIME_TABLES = [
  { name: "mvp_user_candidate_actions", filter: "id=not.is.null" },
  { name: "mvp_listing_ai_classifications", filter: "pid=not.is.null" },
  { name: "mvp_listing_analysis", filter: "pid=not.is.null" },
  { name: "mvp_listings", filter: "pid=not.is.null" },
  { name: "mvp_detail_queue", filter: "id=not.is.null" },
  { name: "mvp_lifecycle_checks", filter: "pid=not.is.null" },
  { name: "mvp_market_key_invalidation", filter: "comparable_key=not.is.null" },
  { name: "mvp_listing_parsed", filter: "pid=not.is.null" },
  { name: "mvp_listing_observations", filter: "id=not.is.null" },
  { name: "mvp_market_price_daily", filter: "comparable_key=not.is.null" },
  { name: "mvp_source_health", filter: "id=not.is.null" },
  { name: "mvp_raw_listings", filter: "pid=not.is.null" },
  { name: "mvp_sellers", filter: "seller_uid=not.is.null" },
  { name: "mvp_collect_runs", filter: "id=not.is.null" },
];

function restBaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function serviceHeaders(prefer?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function authorized(req: NextRequest, bodySecret: unknown) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || bodySecret === secret;
}

async function deleteAllRows(base: string, table: string, filter: string) {
  const headers = serviceHeaders("return=minimal");
  if (!headers) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const res = await fetch(`${base}/${table}?${filter}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    throw new Error(`${table} delete failed: ${res.status} ${await res.text()}`);
  }
}

export async function POST(req: NextRequest) {
  const base = restBaseUrl();
  if (!base) {
    return NextResponse.json({ ok: false, error: "Supabase URL is not configured" }, { status: 500 });
  }

  let body: { confirm?: string; secret?: string } = {};
  try {
    body = (await req.json()) as { confirm?: string; secret?: string };
  } catch {
    body = {};
  }

  if (body.confirm !== "RESET") {
    return NextResponse.json({ ok: false, error: "confirm must be RESET" }, { status: 400 });
  }

  if (!authorized(req, body.secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cleared: string[] = [];
  try {
    for (const table of RUNTIME_TABLES) {
      await deleteAllRows(base, table.name, table.filter);
      cleared.push(table.name);
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        cleared,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    cleared,
    preserved: ["catalog/rules source code", "rule-mining outputs", "category-intelligence outputs"],
    resetAt: new Date().toISOString(),
  });
}
