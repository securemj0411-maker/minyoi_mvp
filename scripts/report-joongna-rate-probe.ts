import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchJoongnaDetail,
  fetchJoongnaSearchProductUrls,
  type JoongnaDetail,
} from "@/lib/joongna";

type ProbeStep = {
  delayMs: number;
  limit: number;
};

type StepResult = {
  delayMs: number;
  requested: number;
  ok: number;
  blocked: number;
  notFound: number;
  errors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  firstBlockReason: string | null;
  sampleTitles: string[];
};

const DEFAULT_QUERIES = [
  "에어팟맥스",
  "아이폰 17 프로",
  "아이패드 프로",
  "맥북",
  "애플워치",
  "마샬 엠버튼 II",
  "다이슨 에어랩",
  "로보락 S8 Pro Ultra",
];

function intArg(name: string, fallback: number, min: number, max: number) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function stringArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function parseSteps(raw: string): ProbeStep[] {
  return raw
    .split(",")
    .map((part) => {
      const [delayRaw, limitRaw] = part.split(":");
      return {
        delayMs: Math.max(0, Number.parseInt(delayRaw ?? "", 10)),
        limit: Math.max(1, Number.parseInt(limitRaw ?? "", 10)),
      };
    })
    .filter((step) => Number.isFinite(step.delayMs) && Number.isFinite(step.limit));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function isBlockingDetail(detail: JoongnaDetail) {
  return detail.blockSignal.blocked || detail.status === 401 || detail.status === 403 || detail.status === 429 || detail.status === 451;
}

async function collectProductUrls(input: {
  queries: string[];
  perQuery: number;
  maxUrls: number;
  timeoutMs: number;
  delayMs: number;
}) {
  const urls = new Set<string>();
  const searchStats: Array<{ query: string; urls: number; error: string | null }> = [];
  for (const query of input.queries) {
    try {
      const found = await fetchJoongnaSearchProductUrls(query, {
        limit: input.perQuery,
        timeoutMs: input.timeoutMs,
      });
      for (const url of found) {
        urls.add(url);
        if (urls.size >= input.maxUrls) break;
      }
      searchStats.push({ query, urls: found.length, error: null });
    } catch (err) {
      searchStats.push({ query, urls: 0, error: err instanceof Error ? err.message : String(err) });
    }
    if (urls.size >= input.maxUrls) break;
    if (input.delayMs > 0) await sleep(input.delayMs);
  }
  return { urls: [...urls], searchStats };
}

async function runStep(urls: string[], step: ProbeStep, cursor: number, timeoutMs: number): Promise<{
  result: StepResult;
  nextCursor: number;
  shouldStop: boolean;
}> {
  const latencies: number[] = [];
  const sampleTitles: string[] = [];
  let ok = 0;
  let blocked = 0;
  let notFound = 0;
  let errors = 0;
  let firstBlockReason: string | null = null;
  let nextCursor = cursor;

  const requested = Math.min(step.limit, urls.length);
  for (let i = 0; i < requested; i += 1) {
    const url = urls[nextCursor % urls.length];
    nextCursor += 1;
    const started = Date.now();
    try {
      const detail = await fetchJoongnaDetail(url, timeoutMs);
      latencies.push(Date.now() - started);
      if (isBlockingDetail(detail)) {
        blocked += 1;
        firstBlockReason ??= detail.blockSignal.reason ?? `http_${detail.status}`;
        break;
      }
      if (detail.status === 404) {
        notFound += 1;
      } else if (detail.ok) {
        ok += 1;
        if (detail.title && sampleTitles.length < 3) sampleTitles.push(detail.title);
      } else {
        errors += 1;
      }
    } catch (err) {
      errors += 1;
      firstBlockReason ??= err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160);
      break;
    }
    if (step.delayMs > 0 && i < requested - 1) await sleep(step.delayMs);
  }

  return {
    nextCursor,
    shouldStop: blocked > 0 || errors > 0,
    result: {
      delayMs: step.delayMs,
      requested,
      ok,
      blocked,
      notFound,
      errors,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      p95LatencyMs: Math.round(percentile(latencies, 95)),
      firstBlockReason,
      sampleTitles,
    },
  };
}

async function main() {
  const queries = stringArg("queries", DEFAULT_QUERIES.join(","))
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  const timeoutMs = intArg("timeoutMs", 10_000, 1_000, 20_000);
  const maxUrls = intArg("maxUrls", 80, 1, 200);
  const perQuery = intArg("perQuery", 12, 1, 30);
  const searchDelayMs = intArg("searchDelayMs", 800, 0, 5_000);
  const steps = parseSteps(stringArg("steps", "1200:8,800:8,500:8,350:8,250:8"));
  const startedAt = new Date().toISOString();

  const collected = await collectProductUrls({
    queries,
    perQuery,
    maxUrls,
    timeoutMs,
    delayMs: searchDelayMs,
  });
  if (collected.urls.length === 0) {
    throw new Error("No Joongna product URLs collected for probe.");
  }

  const stepResults: StepResult[] = [];
  let cursor = 0;
  let stoppedReason: string | null = null;
  for (const step of steps) {
    const { result, nextCursor, shouldStop } = await runStep(collected.urls, step, cursor, timeoutMs);
    stepResults.push(result);
    cursor = nextCursor;
    if (shouldStop) {
      stoppedReason = result.firstBlockReason ?? "step_error_or_block";
      break;
    }
    await sleep(Math.max(1_000, step.delayMs));
  }

  const report = {
    source: "joongna",
    mode: "no_write_safe_rate_probe",
    generatedAt: new Date().toISOString(),
    startedAt,
    safetyPolicy: {
      noDatabaseWrites: true,
      stopOnFirstBlockOrError: true,
      maxUrls,
      note: "This probe estimates a conservative operating envelope. It does not intentionally push the source until failure.",
    },
    inputs: {
      queries,
      perQuery,
      searchDelayMs,
      timeoutMs,
      steps,
    },
    collectedUrls: collected.urls.length,
    searchStats: collected.searchStats,
    steps: stepResults,
    stoppedReason,
    recommendation: stoppedReason
      ? "Use a slower delay than the failed step and keep source-health stop conditions active."
      : "No block observed within this conservative probe. Keep production well below the fastest tested burst.",
  };

  await mkdir(path.join(process.cwd(), "reports"), { recursive: true });
  await writeFile(path.join(process.cwd(), "reports", "joongna-rate-probe-latest.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(process.cwd(), "reports", "joongna-rate-probe-latest.md"), [
    "# Joongna Rate Probe",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- mode: ${report.mode}`,
    `- collectedUrls: ${report.collectedUrls}`,
    `- stoppedReason: ${report.stoppedReason ?? "-"}`,
    "",
    "## Steps",
    "",
    "| delayMs | requested | ok | blocked | notFound | errors | avgLatencyMs | p95LatencyMs | firstBlockReason |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...stepResults.map((step) => `| ${step.delayMs} | ${step.requested} | ${step.ok} | ${step.blocked} | ${step.notFound} | ${step.errors} | ${step.avgLatencyMs} | ${step.p95LatencyMs} | ${step.firstBlockReason ?? ""} |`),
    "",
    `## Recommendation`,
    "",
    report.recommendation,
    "",
  ].join("\n"));

  console.log(JSON.stringify(report, null, 2));
  if (stoppedReason) process.exitCode = 2;
}

main().catch((err) => {
  console.error(JSON.stringify({
    source: "joongna",
    mode: "no_write_safe_rate_probe",
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});
