import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

async function main() {
await loadEnvFile(path.join(appDir, ".env.local"));

const { isPhase2EscrowEnabled, PHASE2_ESCROW_PER_RUN_CAP, evaluatePhase2Escrow } = await import(
  "@/lib/ai-l2-escrow"
);

const eligibleRow = {
  category: "smartphone",
  comparable_key: "iphone|iphone_15_pro|128gb|self",
  parse_confidence: 0.9,
  needs_review: true,
};

const decision = evaluatePhase2Escrow({ parsed: eligibleRow, selectedSoFar: 0 });

console.log(
  JSON.stringify(
    {
      env_loaded_from: ".env.local",
      AI_L2_ESCROW_PHASE2_ENABLED: process.env.AI_L2_ESCROW_PHASE2_ENABLED ?? null,
      AI_L2_ESCROW_PHASE2_PER_RUN_CAP: process.env.AI_L2_ESCROW_PHASE2_PER_RUN_CAP ?? null,
      isPhase2EscrowEnabled: isPhase2EscrowEnabled(),
      effective_per_run_cap: PHASE2_ESCROW_PER_RUN_CAP,
      decision_for_eligible_row: decision,
    },
    null,
    2,
  ),
);

const pass =
  isPhase2EscrowEnabled() === true
  && PHASE2_ESCROW_PER_RUN_CAP === 2
  && decision.eligible === true
  && decision.flag === "ai_escrow_pending";

process.exit(pass ? 0 : 1);
}

main();
