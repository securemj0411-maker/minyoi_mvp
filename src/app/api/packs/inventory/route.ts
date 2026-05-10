import { NextResponse } from "next/server";
import { loadInventory } from "@/lib/pack-open";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const inventory = await loadInventory();
    return NextResponse.json({ inventory, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
