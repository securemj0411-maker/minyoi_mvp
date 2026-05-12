import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string; status: number };

function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function getBearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function requireSupabaseUser(req: Request): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) return requireSupabaseUserFromCookies();

  const env = supabasePublicEnv();
  if (!env) return { ok: false, error: "auth env missing", status: 500 };

  const supabase = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, error: "invalid session", status: 401 };
  return { ok: true, user: data.user };
}

export async function requireSupabaseUserFromCookies(): Promise<AuthResult> {
  const env = supabasePublicEnv();
  if (!env) return { ok: false, error: "auth env missing", status: 500 };

  const cookieStore = await cookies();
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read auth cookies but cannot always write refreshed cookies.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "login required", status: 401 };
  return { ok: true, user: data.user };
}
