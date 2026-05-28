export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app"
).replace(/\/$/, "");

export const PUBLIC_SITE_PATHS = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/how-it-works", changeFrequency: "weekly", priority: 0.8 },
  { path: "/plans", changeFrequency: "weekly", priority: 0.8 },
  { path: "/login", changeFrequency: "monthly", priority: 0.4 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/youth-policy", changeFrequency: "monthly", priority: 0.3 },
] as const;

export function publicUrl(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}
