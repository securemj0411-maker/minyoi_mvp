"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type ClientCreditState = {
  tokens: number;
  infinite: boolean;
  freeGrantedAt: string | null;
};

export async function loadClientCredits(): Promise<ClientCreditState | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch("/api/credits/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const credits = (await res.json()) as Partial<ClientCreditState>;
  return {
    tokens: Math.max(0, Number(credits.tokens ?? 0)),
    infinite: Boolean(credits.infinite),
    freeGrantedAt: typeof credits.freeGrantedAt === "string" ? credits.freeGrantedAt : null,
  };
}
