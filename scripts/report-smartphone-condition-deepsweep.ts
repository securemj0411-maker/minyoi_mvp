import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseEarphoneConditionEvidence } from "@/lib/condition-evidence/earphone";
import { parseTechDeviceConditionEvidence } from "@/lib/condition-evidence/tech-device";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_max: number | null;
  condition_class: string | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  description_preview: string | null;
  price: number | null;
  source: string | null;
  seller_source: string | null;
  url: string | null;
  last_seen_at: string | null;
};

type ParsedRow = {
  pid: number;
  condition_class: string | null;
  condition_notes: string[] | null;
  parsed_json: Record<string, unknown> | null;
};

const DAMAGE_PATTERNS = [
  {
    key: "body_back_frame_damage",
    pattern: /(?:뒷판|후면\s*유리|후면유리|백글라스|뒤판|뒷면|후면).{0,24}(?:깨졌|깨져|깨진|깨짐|깨져서|깨져\s*있|파손|크랙|금\s*갔|금감|금이\s*갔)|(?:깨졌|깨져|깨진|깨짐|깨져서|깨져\s*있|파손|크랙|금\s*갔|금감|금이\s*갔).{0,24}(?:뒷판|후면\s*유리|후면유리|백글라스|뒤판|뒷면|후면)|(?:테두리|프레임|하우징).{0,24}(?:찌그러|함몰|휘어|파손|크랙|들뜸|벌어짐)/,
  },
  {
    key: "foldable_hinge_or_inner_damage",
    pattern: /(?:힌지|흰지|접히는\s*부분|접는\s*부분|가운데|내부\s*액정|내부액정|안쪽\s*액정).{0,28}(?:검은\s*(?:색\s*)?(?:점|반점)|검은점|흑점|반점|멍|세로줄|가로줄|액정\s*불빛|화면\s*나가|불량|파손|크랙|들뜸|벌어짐|안\s*펴|안\s*접|유격|헐거)|(?:접으면|접을\s*때|접힌\s*상태).{0,24}(?:화면\s*나가|꺼짐|안\s*나오|불량)/,
  },
  {
    key: "display_panel_issue_broad",
    pattern: /(?:액정|화면|디스플레이|oled|lcd|패널|내부\s*액정|내부액정|메인\s*화면|커버\s*화면).{0,24}(?:깨졌|깨져|깨진|깨짐|파손|크랙|금\s*갔|금감|반점|검은\s*(?:색\s*)?(?:점|반점)|흑점|멍|세로줄|가로줄|잔상|번인|불량|나감|먹통|터치\s*불량)|(?:깨졌|깨져|깨진|깨짐|파손|크랙|금\s*갔|금감|반점|검은\s*(?:색\s*)?(?:점|반점)|흑점|멍|세로줄|가로줄|잔상|번인|불량|나감|먹통|터치\s*불량).{0,24}(?:액정|화면|디스플레이|oled|lcd|패널|내부\s*액정|내부액정|메인\s*화면|커버\s*화면)/,
  },
  {
    key: "camera_lens_or_module_issue",
    pattern: /(?:카메라|렌즈).{0,18}(?:깨짐|파손|크랙|금\s*갔|불량|흔들림|초점\s*불량|초점불량|안\s*됨|안됨|먹통)|(?:깨짐|파손|크랙|금\s*갔|불량|흔들림|초점\s*불량|초점불량|안\s*됨|안됨|먹통).{0,18}(?:카메라|렌즈)/,
  },
  {
    key: "functional_component_issue",
    pattern: /(?:스피커|마이크|통화|진동|버튼|볼륨|전원|충전단자|유심|sim|와이파이|wifi|블루투스).{0,20}(?:불량|고장|안\s*됨|안됨|불가|문제|먹통|인식\s*불|인식불)|(?:충전).{0,14}(?:불량|고장|안\s*됨|안됨|문제|먹통)|(?:소리|음성|통화).{0,12}이상|이상한\s*(?:소리|음성)|(?:스피커|마이크).{0,8}이상\s*(?:있|있음|발생|생김|납니다|나요)|(?:불량|고장|안\s*됨|안됨|불가|문제|먹통|인식\s*불|인식불).{0,20}(?:스피커|마이크|통화|진동|버튼|볼륨|전원|충전|충전단자|유심|sim|와이파이|wifi|블루투스)/,
  },
] as const;

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function restJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

function normalizeText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ%./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function negatedDamageContext(text: string, key: string) {
  const compact = text.replace(/\s+/g, "");
  if (key === "body_back_frame_damage") {
    return /(?:뒷판|뒤판|뒷면|후면유리|백글라스|후면|테두리|프레임|하우징).{0,24}(?:깨끗|깔끔|정상|파손없|깨짐없|크랙없|기스없|찍힘없)/.test(compact);
  }
  if (key === "foldable_hinge_or_inner_damage") {
    return /(?:힌지|흰지|접히는부분|접는부분|내부액정|안쪽액정).{0,24}(?:정상|문제없|이상없|깨끗|깔끔|유격없|벌어짐없|반점없|검은점없)/.test(compact);
  }
  if (key === "camera_lens_or_module_issue") {
    return /(?:카메라|렌즈).{0,18}(?:정상|문제없|이상없|잘됨|잘됩니다|무음)/.test(compact);
  }
  if (key === "functional_component_issue") {
    return /네고불가|교환불가|환불불가|택배거래희망|이상x|(?:스피커|마이크|통화|진동|버튼|볼륨|전원|충전|유심|와이파이|블루투스|소리|연결|작동).{0,28}(?:정상|문제없|문제는없|큰문제는없|이상없|이상전혀없|전혀없|이상무|잘됨|잘됩니다|잘되는상태)|(?:기능|전기능|모든기능).{0,18}(?:완벽하게작동|정상|문제없|이상없|전혀없|잘됨)|(?:모든문제|큰문제|문제|하자).{0,8}(?:없|없음|없습니다|없어요|없는)/.test(compact);
  }
  return /(파손|깨짐|깨진|크랙|금|고장|불량|하자|문제|멍|반점|흑점|검은점|잔상|번인).{0,16}(없|없음|없습니다|없이|아님|아닙니다|정상|깨끗|깔끔)/.test(compact);
}

function learnedDamageTags(title: string, description: string) {
  const text = normalizeText(`${title}\n${description}`);
  return DAMAGE_PATTERNS
    .filter((item) => item.pattern.test(text) && !negatedDamageContext(text, item.key))
    .map((item) => item.key);
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function mdTable(headers: string[], rows: unknown[][]) {
  const clean = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  const select = "pid,name,description_preview,price,source,seller_source,url,last_seen_at";
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  const select = "pid,condition_class,condition_notes,parsed_json";
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=${select}&pid=in.(${part.join(",")})&limit=${part.length}`,
    ));
  }
  return rows;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await mkdir(reportsDir, { recursive: true });

  const limit = Number(arg("limit", "3000"));
  const category = arg("category", "smartphone");
  const allowedCategories = new Set([
    "earphone",
    "smartphone",
    "tablet",
    "smartwatch",
    "laptop",
    "monitor",
    "speaker",
    "camera",
    "desktop",
    "home_appliance",
    "small_appliance",
    "drone",
  ]);
  if (!allowedCategories.has(category)) {
    throw new Error(`Unsupported category "${category}". Use one of: ${[...allowedCategories].join(", ")}`);
  }
  const reportBaseName = `${category}-condition-deepsweep-latest`;
  const poolRows = await restJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,condition_class,comparable_key,expected_profit_max,last_verified_at&category=eq.${category}&status=in.(ready,reserved)&order=last_verified_at.desc.nullslast&limit=${limit}`,
  );
  const pids = poolRows.map((row) => Number(row.pid)).filter((pid) => Number.isFinite(pid));
  const [rawRows, parsedRows] = await Promise.all([fetchRawRows(pids), fetchParsedRows(pids)]);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const analyzed = poolRows.map((pool) => {
    const raw = rawByPid.get(Number(pool.pid));
    const parsed = parsedByPid.get(Number(pool.pid));
    const title = raw?.name ?? "";
    const description = raw?.description_preview ?? "";
    const evidence = category === "earphone"
      ? parseEarphoneConditionEvidence({ title, description })
      : parseTechDeviceConditionEvidence({ title, description });
    const learnedTags = learnedDamageTags(title, description);
    return {
      pid: Number(pool.pid),
      title,
      description,
      price: raw?.price ?? null,
      source: raw?.source ?? raw?.seller_source ?? null,
      status: pool.status,
      comparableKey: pool.comparable_key,
      expectedProfitMax: pool.expected_profit_max,
      currentConditionClass: parsed?.condition_class ?? pool.condition_class,
      currentConditionNotes: parsed?.condition_notes ?? [],
      currentHardCandidates: evidence.hardBlockCandidates,
      learnedTags,
      url: raw?.url ?? null,
    };
  });

  const candidateRows = analyzed.filter((row) => row.currentHardCandidates.length > 0 || row.learnedTags.length > 0);
  const missedByCurrentEvidence = candidateRows.filter((row) => row.currentHardCandidates.length === 0 && row.learnedTags.length > 0);
  const conditionStillNormal = candidateRows.filter((row) => row.currentConditionClass !== "flawed");
  const patternCounts = countBy(
    candidateRows.flatMap((row) => [...row.learnedTags, ...row.currentHardCandidates.map((signal) => `current:${signal}`)]),
    (key) => key,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    scope: {
      category,
      statuses: ["ready", "reserved"],
      limit,
      poolRows: poolRows.length,
    },
    metrics: {
      candidateRows: candidateRows.length,
      missedByCurrentEvidence: missedByCurrentEvidence.length,
      conditionStillNormal: conditionStillNormal.length,
    },
    patternCounts,
    bySource: countBy(candidateRows, (row) => row.source),
    missedSamples: missedByCurrentEvidence.slice(0, 40),
    samples: candidateRows.slice(0, 80),
  };

  await writeFile(path.join(reportsDir, `${reportBaseName}.json`), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    `# ${category} Condition Deep Sweep`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `No-write report over ready/reserved ${category} pool rows. Compares current tech evidence parser against broader learned Korean defect phrases.`,
    "",
    "## Metrics",
    "",
    mdTable(["metric", "value"], Object.entries(report.metrics)),
    "",
    "## Pattern Counts",
    "",
    mdTable(["pattern", "count"], report.patternCounts.map((row) => [row.key, row.count])),
    "",
    "## Missed Samples",
    "",
    mdTable(
      ["pid", "source", "class", "title", "price", "tags", "description"],
      report.missedSamples.slice(0, 25).map((row) => [
        row.pid,
        row.source,
        row.currentConditionClass,
        row.title,
        row.price,
        row.learnedTags.join(", "),
        row.description.slice(0, 220),
      ]),
    ),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, `${reportBaseName}.md`), `${md}\n`);

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    metrics: report.metrics,
    patternCounts: report.patternCounts,
    reportJson: `reports/${reportBaseName}.json`,
    reportMd: `reports/${reportBaseName}.md`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
