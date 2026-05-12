import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part, total, digits = 1) {
  if (!total) return "0%";
  return `${((n(part) / n(total)) * 100).toFixed(digits)}%`;
}

function num(value) {
  return Math.round(n(value)).toLocaleString("ko-KR");
}

function seconds(ms) {
  return `${(n(ms) / 1000).toFixed(1)}s`;
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

const now = new Date();
const reportDir = path.join(appDir, "reports");
const sourcePath = arg("source", path.join(reportDir, "tick-write-amplification-latest.json"));
const outPath = arg("out", path.join(reportDir, `raw-touch-coalescing-design-${dateStamp(now)}.md`));
const summaryPath = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportDir, "raw-touch-coalescing-design-latest.md");
const latestJson = path.join(reportDir, "raw-touch-coalescing-design-latest.json");
const tickMinutes = intArg("tick-minutes", 5, 1, 60);
const candidateWindowMinutes = intArg("candidate-window-minutes", 10, 5, 120);
const generalWindowMinutes = intArg("general-window-minutes", 30, 5, 240);

const source = await readJson(sourcePath, {});
const totals = source?.totals ?? {};
const ratios = source?.ratios ?? {};
const timings = source?.timings ?? {};

const uniqueItems = n(totals.unique);
const rawTouchRows = n(totals.rawTouch);
const activeSeenOnlyRows = n(totals.rawTouchSeen);
const activeStateResetRows = n(totals.rawTouchReset);
const terminalRows = n(totals.rawTouchTerminal);
const rawFullRows = n(totals.rawFull);
const changedItems = n(totals.changed);
const observations = n(totals.observations);
const rawTouchMs = n(totals.touch_raw_listings_ms);

function estimatedSavedRows(windowMinutes, eligibleRows) {
  if (windowMinutes <= tickMinutes) return 0;
  const keepRatio = tickMinutes / windowMinutes;
  return Math.max(0, Math.round(eligibleRows * (1 - keepRatio)));
}

const eligibility = {
  eligible: activeSeenOnlyRows,
  protected: activeStateResetRows + terminalRows + rawFullRows + observations,
  activeSeenOnlyRows,
  activeStateResetRows,
  terminalRows,
  rawFullRows,
  observations,
};

const estimates = [
  {
    name: "candidate_safe_10m",
    windowMinutes: candidateWindowMinutes,
    eligibleRows: activeSeenOnlyRows,
    estimatedSavedRows: estimatedSavedRows(candidateWindowMinutes, activeSeenOnlyRows),
    scope: "Only activeSeenOnly rows; keep all state reset and terminal sightings.",
  },
  {
    name: "general_safe_30m",
    windowMinutes: generalWindowMinutes,
    eligibleRows: activeSeenOnlyRows,
    estimatedSavedRows: estimatedSavedRows(generalWindowMinutes, activeSeenOnlyRows),
    scope: "Same eligibility, wider interval for non-candidate rows only after pool-aware split exists.",
  },
];

for (const estimate of estimates) {
  estimate.estimatedRemainingRows = Math.max(0, estimate.eligibleRows - estimate.estimatedSavedRows);
  estimate.estimatedTouchMsSaved = rawTouchRows
    ? Math.round(rawTouchMs * (estimate.estimatedSavedRows / rawTouchRows))
    : 0;
}

const recommended = {
  featureFlag: "RAW_TOUCH_COALESCE_ACTIVE_SEEN_ONLY",
  default: "off",
  firstRollout: {
    mode: "dry_run_metrics_only",
    windowMinutes: candidateWindowMinutes,
    targetRows: "activeSeenOnly only",
  },
  secondRollout: {
    mode: "write_skip_enabled_for_non_pool_activeSeenOnly",
    windowMinutes: candidateWindowMinutes,
    guard: "requires pool-aware or score-ready-aware split before enabling",
  },
};

const summary = {
  generatedAt: now.toISOString(),
  sourcePath,
  sourceGeneratedAt: source?.generatedAt ?? null,
  tickMinutes,
  candidateWindowMinutes,
  generalWindowMinutes,
  baseline: {
    uniqueItems,
    changedItems,
    rawFullRows,
    rawTouchRows,
    activeSeenOnlyRows,
    activeStateResetRows,
    terminalRows,
    observations,
    rawTouchMs,
    changedToUnique: ratios.changedToUnique ?? null,
    rawTouchToUnique: ratios.rawTouchToUnique ?? null,
    dbWriteMs: timings.dbWriteMs ?? null,
  },
  eligibility,
  estimates,
  recommended,
  implementationBoundaries: {
    doNotChange: [
      "search query count or rotation",
      "raw full upsert eligibility",
      "active state reset writes",
      "terminal reappearance writes",
      "observation event insert semantics",
      "candidate pool live verification",
      "lifecycle check cadence",
      "sold velocity materialization semantics",
    ],
    proposedLaterFiles: [
      "src/lib/tick-pipeline.ts",
      "src/lib/pipeline-config.ts",
      "tests/core-rules.test.ts",
    ],
  },
};

const md = `# Raw Touch Coalescing Design

- generated_at: ${now.toISOString()}
- source: \`${path.relative(appDir, sourcePath)}\`
- mode: implementation-prep / no runtime change

## 결론

- 현재 write amplification의 중심은 full upsert가 아니라 \`activeSeenOnly -> last_seen_at\` touch다.
- 하지만 \`last_seen_at\`은 score 후보 정렬, lifecycle 재등장 판단, terminal interval, 시장 속도 보조 신호에 닿는다.
- 따라서 첫 구현은 **기능 보존형 feature flag + dry-run metrics**로 시작해야 한다.
- 안전한 coalescing 대상은 \`activeSeenOnly\`뿐이다.
- \`activeStateReset\`, \`terminal\`, \`rawFullUpsert\`, \`observationRows\`는 coalescing 대상이 아니다.

## Baseline

${table(
  ["metric", "value", "share"],
  [
    ["unique items", num(uniqueItems), "100%"],
    ["changed items", num(changedItems), pct(changedItems, uniqueItems)],
    ["raw full upsert rows", num(rawFullRows), pct(rawFullRows, uniqueItems)],
    ["raw touch rows", num(rawTouchRows), pct(rawTouchRows, uniqueItems)],
    ["activeSeenOnly rows", num(activeSeenOnlyRows), pct(activeSeenOnlyRows, rawTouchRows)],
    ["activeStateReset rows", num(activeStateResetRows), pct(activeStateResetRows, rawTouchRows)],
    ["terminal touch rows", num(terminalRows), pct(terminalRows, rawTouchRows)],
    ["observation rows", num(observations), pct(observations, uniqueItems)],
    ["touch_raw_listings duration", seconds(rawTouchMs), "-"],
  ],
)}

## Coalescing Eligibility

${table(
  ["bucket", "rows", "decision", "reason"],
  [
    ["activeSeenOnly", num(activeSeenOnlyRows), "eligible with flag", "already active, no missing reset, no terminal recovery"],
    ["activeStateReset", num(activeStateResetRows), "protected", "missing/disappeared recovery semantics; must write immediately"],
    ["terminal", num(terminalRows), "protected", "terminal reappeared in search; lifecycle recheck depends on this signal"],
    ["rawFullUpsert", num(rawFullRows), "protected", "price/title/source update/detail triage payload changed"],
    ["observationRows", num(observations), "protected", "sold velocity and daily/event history basis"],
  ],
)}

## Estimated Savings

These are upper-bound estimates from aggregate timing. Exact savings require a dry-run metric inside \`searchStage\`.

${table(
  ["plan", "window", "eligible rows", "estimated skipped rows", "remaining rows", "estimated touch time saved", "scope"],
  estimates.map((estimate) => [
    estimate.name,
    `${estimate.windowMinutes}m`,
    num(estimate.eligibleRows),
    `${num(estimate.estimatedSavedRows)} (${pct(estimate.estimatedSavedRows, estimate.eligibleRows)})`,
    num(estimate.estimatedRemainingRows),
    seconds(estimate.estimatedTouchMsSaved),
    estimate.scope,
  ]),
)}

## Recommended Rollout

### Phase A - Dry-run metrics only

- Add feature flag: \`${recommended.featureFlag}\`, default off.
- Do not skip any write yet.
- Add timing counters:
  - \`raw_touch_active_seen_coalesce_eligible_rows\`
  - \`raw_touch_active_seen_coalesce_would_skip_rows\`
  - \`raw_touch_active_seen_coalesce_protected_rows\`
- Use \`${candidateWindowMinutes}m\` as the first dry-run window.
- Run for at least one normal 24h cycle before enabling write skip.

### Phase B - Safe write skip

- Enable only for \`activeSeenOnly\`.
- Keep \`activeStateReset\`, \`terminal\`, \`rawFullUpsert\`, and observation writes unchanged.
- Do not apply to rows that are currently in candidate pool \`ready/reserved\` unless candidate-pool verified freshness remains healthy.
- Keep a rollback flag that restores current behavior instantly.

### Phase C - Wider non-candidate interval

- Only after Phase B has stable pack-open quality and lifecycle mismatch.
- Consider \`${generalWindowMinutes}m\` for non-candidate rows.
- Keep candidate/pool/near-pool rows at tighter precision.

## Correctness Guardrails

1. Pack open must remain healthy:
   - \`npm run report:pack-open-quality\`
   - target: reveal remains near current baseline, live errors do not increase.
2. Lifecycle mismatch must not increase:
   - \`npm run report:lifecycle-mismatch\`
   - terminal reappeared rows should still route to detail recheck.
3. Terminal interval report must not lose signal:
   - \`npm run report:terminal-interval-candidates\`
   - active_with_sold_detected_at should not spike unexpectedly.
4. Tick write report should show actual reduction:
   - \`npm run report:tick-write-amplification -- --window-hours=2 --run-limit=160\`
   - \`raw_touch_active_seen_rows\` should drop only after feature flag enablement.
5. DB health remains healthy:
   - \`npm run report:db-hotpaths -- --window-hours=1 --run-limit=80 --queue-limit=300\`

## Later Implementation Proposal

Proposed files, not edited by this report:

- \`src/lib/pipeline-config.ts\`
  - add feature flag and interval config.
- \`src/lib/tick-pipeline.ts\`
  - split \`activeSeenOnly\` into \`touchNow\` and \`coalescedSkip\`.
  - use existing \`current.last_seen_at\` from \`loadExistingRaw\`.
  - emit dry-run counters before write skipping.
- \`tests/core-rules.test.ts\`
  - add unit tests for coalescing eligibility:
    - skip only when active, unchanged, non-terminal, no state reset, interval not expired.
    - never skip missing reset.
    - never skip terminal preserved reappearance.
    - never skip full raw upsert.

## Explicit Non-Goals

- No tick query rotation.
- No search query count reduction.
- No broad index or DDL.
- No pack-open freshness threshold change.
- No lifecycle cadence change.
- No observation deletion.
- No candidate pool public policy change.

## Next Action

Proceed to Phase A only: add dry-run counters behind a default-off flag, then compare reports over a normal operating window.
`;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
await writeFile(latestMd, md, "utf-8");
await writeFile(latestJson, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

console.log(`report saved  -> ${outPath}`);
console.log(`summary saved -> ${summaryPath}`);
console.log(`latest saved  -> ${latestMd}`);
console.log(`eligible=${activeSeenOnlyRows} protected=${eligibility.protected}`);
console.log(`phaseA=${recommended.featureFlag} default=${recommended.default}`);
