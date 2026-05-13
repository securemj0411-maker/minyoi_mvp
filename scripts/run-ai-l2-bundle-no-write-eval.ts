import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type PromptPacket = {
  rows: Array<{
    lane: string;
    pid: string;
    title: string;
    price: number;
    cacheKeyPreview: string;
    userPayload: unknown;
  }>;
  samplePrompts: Array<{
    systemPrompt: string;
  }>;
};

type EvalResult = {
  pid: string;
  lane: string;
  title: string;
  price: number;
  ok: boolean;
  model: string;
  elapsedMs: number;
  cacheKeyPreview: string;
  rawContent?: string;
  parsed?: unknown;
  error?: string;
  usage?: {
    promptTokens: number | null;
    cachedTokens: number | null;
    completionTokens: number | null;
  };
};

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, fileName), "utf8")) as T;
}

async function readEnvLocalValue(key: string) {
  if (process.env[key]) return process.env[key] ?? "";
  try {
    const content = await readFile(path.join(appDir, ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith(`${key}=`)) continue;
      const rawValue = trimmed.slice(key.length + 1).trim();
      return rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    return "";
  }
  return "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function normalizedBundleResult(row: EvalResult) {
  if (!row.parsed || typeof row.parsed !== "object") return null;
  const parsed = row.parsed as { fields?: unknown };
  const fields = parsed.fields && typeof parsed.fields === "object" ? parsed.fields : parsed;
  return {
    pid: row.pid,
    lane: row.lane,
    ...(fields as Record<string, unknown>),
  };
}

async function classifyOne(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  row: PromptPacket["rows"][number];
  timeoutMs: number;
}): Promise<EvalResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: JSON.stringify(input.row.userPayload) },
        ],
      }),
    });

    const elapsedMs = Date.now() - startedAt;
    if (!res.ok) {
      const body = await res.text();
      return {
        pid: input.row.pid,
        lane: input.row.lane,
        title: input.row.title,
        price: input.row.price,
        ok: false,
        model: input.model,
        elapsedMs,
        cacheKeyPreview: input.row.cacheKeyPreview,
        error: `${res.status} ${body.slice(0, 300)}`,
      };
    }

    const json = await res.json();
    const content = String(json.choices?.[0]?.message?.content ?? "");
    const cached = asNumber(json.usage?.prompt_tokens_details?.cached_tokens);
    return {
      pid: input.row.pid,
      lane: input.row.lane,
      title: input.row.title,
      price: input.row.price,
      ok: true,
      model: input.model,
      elapsedMs,
      cacheKeyPreview: input.row.cacheKeyPreview,
      rawContent: content,
      parsed: parseJsonContent(content),
      usage: {
        promptTokens: asNumber(json.usage?.prompt_tokens),
        cachedTokens: cached,
        completionTokens: asNumber(json.usage?.completion_tokens),
      },
    };
  } catch (err) {
    return {
      pid: input.row.pid,
      lane: input.row.lane,
      title: input.row.title,
      price: input.row.price,
      ok: false,
      model: input.model,
      elapsedMs: Date.now() - startedAt,
      cacheKeyPreview: input.row.cacheKeyPreview,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const enabled = process.env.AI_L2_BUNDLE_EVAL_ENABLE === "1";
  const packet = await readJson<PromptPacket>("ai-l2-bundle-eval-prompt-packet-latest.json");
  const cap = Math.max(1, Number(process.env.AI_L2_BUNDLE_EVAL_CAP ?? packet.rows.length));
  const model = process.env.AI_L2_BUNDLE_MODEL ?? process.env.AI_L2_MODEL ?? process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4o-mini";
  const timeoutMs = Math.max(2_000, Number(process.env.AI_L2_BUNDLE_EVAL_TIMEOUT_MS ?? 12_000));
  const apiKey = await readEnvLocalValue("OPENAI_API_KEY");
  const systemPrompt = packet.samplePrompts[0]?.systemPrompt ?? "";
  const rows = packet.rows.slice(0, cap);

  const results: EvalResult[] = [];
  let decision = "disabled_no_api_call";
  if (enabled && apiKey && systemPrompt) {
    decision = "ran_no_write_ai_l2_bundle_eval";
    for (const row of rows) {
      results.push(await classifyOne({ apiKey, model, systemPrompt, row, timeoutMs }));
    }
  } else if (enabled && !apiKey) {
    decision = "enabled_but_openai_api_key_missing_no_api_call";
  } else if (enabled && !systemPrompt) {
    decision = "enabled_but_system_prompt_missing_no_api_call";
  }

  const output = {
    generatedAt,
    scope: "ai_l2_bundle_no_write_eval",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    enabled,
    model,
    cap,
    timeoutMs,
    rowsConsidered: rows.length,
    results,
    metrics: {
      okRows: results.filter((row) => row.ok).length,
      failedRows: results.filter((row) => !row.ok).length,
      promptTokens: results.reduce((sum, row) => sum + (row.usage?.promptTokens ?? 0), 0),
      cachedTokens: results.reduce((sum, row) => sum + (row.usage?.cachedTokens ?? 0), 0),
      completionTokens: results.reduce((sum, row) => sum + (row.usage?.completionTokens ?? 0), 0),
    },
    decision,
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-no-write-eval-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(
    path.join(reportsDir, "ai-l2-bundle-no-write-eval-results-latest.json"),
    `${JSON.stringify({ generatedAt, rows: results.map(normalizedBundleResult).filter(Boolean) }, null, 2)}\n`,
  );

  const md = [
    "# AI L2 Bundle No-Write Eval",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${decision}`,
    `- enabled: ${enabled}`,
    `- model: ${model}`,
    `- cap: ${cap}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    "```json",
    JSON.stringify(output.metrics, null, 2),
    "```",
    "",
    enabled
      ? "- If results exist, validate with `AI_L2_BUNDLE_RESULTS_FILE=ai-l2-bundle-no-write-eval-results-latest.json npm run report:ai-l2-bundle-result-validator`."
      : "- No API call was made. Set `AI_L2_BUNDLE_EVAL_ENABLE=1` only for tiny no-write evaluation.",
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "ai-l2-bundle-no-write-eval-latest.md"), md);
  console.log(JSON.stringify({ decision, ...output.metrics }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
