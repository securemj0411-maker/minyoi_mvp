// Wave 90 (2026-05-15): 사용자 코멘트 해결 마킹 도구.
// 사용: npm run mark:resolved -- --pid=<pid> --commit=<hash> --summary="..."
// reports/feedback-resolutions.json에 추가/업데이트. git에 commit해서 history 추적.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const FILE = path.join(appDir, "docs/feedback-resolutions.json");

function arg(name) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

const pid = arg("pid");
const commit = arg("commit");
const summary = arg("summary");

if (!pid || !commit || !summary) {
  console.error("usage: npm run mark:resolved -- --pid=<pid> --commit=<hash> --summary=\"...\"");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(await readFile(FILE, "utf-8"));
} catch {
  data = { _schema: "pid → { resolved_at, summary, commits[] }", resolutions: {} };
}

const existing = data.resolutions[pid];
if (existing) {
  // 추가 commit + summary append
  existing.commits = [...new Set([...(existing.commits ?? []), commit])];
  existing.summary = `${existing.summary} | ${summary}`;
  existing.resolved_at = new Date().toISOString();
  console.log(`updated: pid ${pid} (${existing.commits.length} commits)`);
} else {
  data.resolutions[pid] = {
    resolved_at: new Date().toISOString(),
    summary,
    commits: [commit],
  };
  console.log(`marked resolved: pid ${pid}`);
}
data._updated_at = new Date().toISOString();

await writeFile(FILE, JSON.stringify(data, null, 2));
console.log(`→ ${path.relative(appDir, FILE)}`);
console.log("\n잊지 말고 git commit + push 하셈.");
