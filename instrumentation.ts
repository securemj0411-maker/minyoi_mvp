// Wave launch-8 (audit CRITICAL #7): Sentry server + edge 에러 추적.
// Next.js register hook 으로 서버 시작 시 Sentry init.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === "production",
      sendDefaultPii: false,
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === "production",
      sendDefaultPii: false,
    });
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: { [key: string]: string | string[] | undefined } },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: "render" | "route" | "action" | "middleware" },
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
