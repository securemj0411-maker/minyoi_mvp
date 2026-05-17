// Wave 191 (2026-05-17): Storage 백업 → DB 복원 CLI utility.
// PITR 대안 (Wave 186 + 189) — 사고 시 storage 의 JSONL 을 DB 에 복원.
//
// 안전 보호:
// - CLI 전용 (production API endpoint 박지 않음)
// - dry-run 기본 (--confirm 없으면 박지 않고 row 수 + sample 만 출력)
// - 테이블별 UPSERT key + 운영 충돌 경고
//
// 사용:
//   # dry-run (안전 — 박지 않고 미리보기)
//   npx tsx scripts/restore-backup.mjs --date=2026-05-17 --table=mvp_user_credits
//
//   # 실제 복원 (destructive — 운영자 명시 confirm)
//   npx tsx scripts/restore-backup.mjs --date=2026-05-17 --table=mvp_user_credits --confirm
//
// 테이블별 strategy (docs/runbook/restore-backup.md 참고):
//   ✅ 안전 (운영 변경 X):
//      - mvp_user_credits        (UPSERT on user_ref + auth_user_id)
//      - mvp_user_plans          (UPSERT on auth_user_id)
//      - mvp_reveal_feedback     (UPSERT on user_ref + pid)
//   ⚠️ 주의 (운영 중 재집계 가능):
//      - mvp_candidate_pool      (UPSERT on pid — tick-pipeline 즉시 재계산 가능)
//      - mvp_market_velocity_daily (UPSERT on date + comparable_key — 어제 이전 row 만 권장)
//      - mvp_market_price_daily    (UPSERT on date + comparable_key — 어제 이전 row 만 권장)
//      - mvp_listing_parsed      (UPSERT on pid — parser 매물 볼 때 다시 박음)

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const BUCKET = "mvp-backups";
const CHUNK_SIZE = 500; // UPSERT batch size

const TABLE_CONFIG = {
  mvp_user_credits:           { onConflict: "user_ref,auth_user_id", safety: "safe" },
  mvp_user_plans:             { onConflict: "auth_user_id",          safety: "safe" },
  mvp_reveal_feedback:        { onConflict: "user_ref,pid",          safety: "safe" },
  mvp_candidate_pool:         { onConflict: "pid",                   safety: "warn" },
  mvp_market_velocity_daily:  { onConflict: "date,comparable_key,condition_class", safety: "warn" },
  mvp_market_price_daily:     { onConflict: "date,comparable_key,condition_class", safety: "warn" },
  mvp_listing_parsed:         { onConflict: "pid",                   safety: "warn" },
};

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return fallback;
}

function supabaseBase() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL missing");
  return raw.replace(/\/$/, "");
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return key;
}

async function downloadFromStorage(date, table) {
  const url = `${supabaseBase()}/storage/v1/object/${BUCKET}/${date}/${table}.jsonl`;
  const key = serviceKey();
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) {
    throw new Error(`storage_fetch_failed ${res.status}: ${await res.text().catch(() => "?")}`);
  }
  return await res.text();
}

function parseJsonl(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch (err) {
      console.error(`  parse failed (line skipped): ${err.message}`);
    }
  }
  return rows;
}

async function upsertChunk(table, rows, onConflict) {
  const url = `${supabaseBase()}/rest/v1/${table}?on_conflict=${onConflict}`;
  const key = serviceKey();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "?");
    throw new Error(`upsert_failed ${res.status}: ${text.slice(0, 500)}`);
  }
}

async function main() {
  const date = arg("date");
  const table = arg("table");
  const confirm = arg("confirm") === "true";

  if (!date || !table) {
    console.error("사용법:");
    console.error("  npx tsx scripts/restore-backup.mjs --date=YYYY-MM-DD --table=<table_name>");
    console.error("  옵션: --confirm  (실제 복원 — 명시적 운영자 confirm)");
    console.error("");
    console.error("가능한 테이블:");
    for (const [name, cfg] of Object.entries(TABLE_CONFIG)) {
      const icon = cfg.safety === "safe" ? "✅" : "⚠️";
      console.error(`  ${icon} ${name}  (on_conflict: ${cfg.onConflict})`);
    }
    process.exit(1);
  }

  const cfg = TABLE_CONFIG[table];
  if (!cfg) {
    console.error(`unknown table: ${table}`);
    console.error(`가능한 테이블: ${Object.keys(TABLE_CONFIG).join(", ")}`);
    process.exit(1);
  }

  console.log("=== restore-backup ===");
  console.log(`date:        ${date}`);
  console.log(`table:       ${table}`);
  console.log(`on_conflict: ${cfg.onConflict}`);
  console.log(`safety:      ${cfg.safety === "safe" ? "✅ 운영 변경 없음" : "⚠️ 운영 중 재집계 가능"}`);
  console.log(`mode:        ${confirm ? "🔴 DESTRUCTIVE (--confirm)" : "🟢 dry-run"}`);
  console.log("");

  // 1. Storage 다운로드
  console.log(`📥 ${BUCKET}/${date}/${table}.jsonl 다운로드...`);
  let text;
  try {
    text = await downloadFromStorage(date, table);
  } catch (err) {
    console.error(`❌ 다운로드 실패: ${err.message}`);
    console.error(`   → ${date} 폴더에 backup 파일이 박혀있는지 확인.`);
    process.exit(1);
  }
  console.log(`   다운로드 완료 — ${(text.length / 1024).toFixed(1)} KB`);

  // 2. JSONL 파싱
  const rows = parseJsonl(text);
  console.log(`📋 파싱 — ${rows.length} rows`);
  if (rows.length === 0) {
    console.log("   복원할 row 없음.");
    process.exit(0);
  }

  // 3. Sample 출력 (첫 2 row)
  console.log("");
  console.log("--- sample (앞 2 row) ---");
  for (const sample of rows.slice(0, 2)) {
    console.log(JSON.stringify(sample, null, 2).split("\n").slice(0, 12).join("\n"));
    console.log("---");
  }

  // 4. Dry-run / Confirm 분기
  if (!confirm) {
    console.log("");
    console.log("🟢 dry-run — 실제 박지 않음.");
    console.log("   실제 복원: 같은 인자에 --confirm 추가.");
    console.log("");
    if (cfg.safety === "warn") {
      console.log(`⚠️ ${table} 운영 충돌 경고:`);
      if (table === "mvp_candidate_pool") {
        console.log("   tick-pipeline 정기 갱신이 즉시 덮어쓸 수 있음. 복원 의미 약함.");
      } else if (table.startsWith("mvp_market_")) {
        console.log("   매일 새벽 집계가 어제 row 박음. 어제 이전 row 만 안전.");
      } else if (table === "mvp_listing_parsed") {
        console.log("   parser 가 매물 볼 때마다 박음. 다시 덮어쓸 수 있음.");
      }
    }
    process.exit(0);
  }

  // 5. 실제 UPSERT
  console.log("");
  console.log(`🔴 ${rows.length} rows UPSERT 시작...`);
  let success = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    try {
      await upsertChunk(table, chunk, cfg.onConflict);
      success += chunk.length;
      process.stdout.write(`\r   진행: ${success}/${rows.length}`);
    } catch (err) {
      failed += chunk.length;
      console.error(`\n   ❌ chunk ${i}-${i + chunk.length} 실패: ${err.message}`);
    }
  }
  console.log("");
  console.log("");
  console.log(`✅ 완료 — success ${success} / failed ${failed} / total ${rows.length}`);

  if (failed > 0) {
    console.log("");
    console.log("⚠️ 일부 실패. 로그 확인 + DB 직접 검증 권장.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("");
  console.error(`❌ restore-backup 실패: ${err.message}`);
  process.exit(1);
});
