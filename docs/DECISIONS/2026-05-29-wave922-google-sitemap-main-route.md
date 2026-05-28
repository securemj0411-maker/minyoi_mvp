# Wave 922 — Google sitemap fallback route

## Decision
- Keep the existing Next.js metadata sitemap at `/sitemap.xml`.
- Add a route-handler sitemap at `/sitemap-main.xml` that returns explicit XML with `application/xml`.
- Share the public URL list between `/sitemap.xml`, `/sitemap-main.xml`, and `robots.txt` so public page drift does not recur.
- Advertise both sitemap URLs from `robots.txt`.

## Why
- Google Search Console can remain stuck on a failed `/sitemap.xml` fetch even after the XML becomes valid.
- A clean filename gives Search Console a fresh URL to fetch while preserving the canonical `/sitemap.xml`.
- The Vercel deployment URL is protected and should not be submitted to Google; production sitemap URLs must stay on `https://minyoi-mvp.vercel.app`.

## Deferred
- If a custom production domain replaces `minyoi-mvp.vercel.app`, set `NEXT_PUBLIC_SITE_ORIGIN` in Vercel before submitting sitemaps.
