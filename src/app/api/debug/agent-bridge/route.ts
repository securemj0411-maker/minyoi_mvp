import { NextRequest, NextResponse } from "next/server";

import {
  ackBridgeMessages,
  bridgeHealth,
  pullBridgeMessages,
  pushBridgeMessage,
} from "@/lib/agent-bridge";

export const runtime = "nodejs";
export const maxDuration = 60;

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function checkBridgeAuth(req: NextRequest) {
  const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
  if (!secret) {
    return isDev()
      ? { ok: true as const }
      : { ok: false as const, status: 500, error: "AGENT_BRIDGE_SECRET missing" };
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token === secret) return { ok: true as const };
  return { ok: false as const, status: 401, error: "unauthorized" };
}

function parseBool(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(parsed, 200));
}

async function handleGet(req: NextRequest) {
  const auth = checkBridgeAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "pull";
  if (mode === "health") {
    const health = await bridgeHealth();
    return NextResponse.json({ ok: true, mode, ...health });
  }

  const agent = req.nextUrl.searchParams.get("agent") ?? "";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const includeAcked = parseBool(req.nextUrl.searchParams.get("include_acked"));
  if (!agent.trim()) {
    return NextResponse.json({ ok: false, error: "agent is required" }, { status: 400 });
  }

  const messages = await pullBridgeMessages({ agent, limit, includeAcked });
  return NextResponse.json({
    ok: true,
    mode: "pull",
    agent,
    count: messages.length,
    messages,
  });
}

async function handlePost(req: NextRequest) {
  const auth = checkBridgeAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const payload = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const mode = typeof payload.mode === "string" ? payload.mode : "push";

  if (mode === "ack") {
    const agent = typeof payload.agent === "string" ? payload.agent : "";
    const ids = Array.isArray(payload.ids) ? payload.ids.map((value) => String(value)) : [];
    const result = await ackBridgeMessages({ agent, ids });
    return NextResponse.json({ ok: true, mode, ...result });
  }

  const from = typeof payload.from === "string" ? payload.from : "";
  const to = typeof payload.to === "string" ? payload.to : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  const message = await pushBridgeMessage({ from, to, text });
  return NextResponse.json({ ok: true, mode: "push", message });
}

export async function GET(req: NextRequest) {
  try {
    return await handleGet(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
