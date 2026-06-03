import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function quotedConst(source: string, name: string) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s+"([^"]+)"`));
  assert.ok(match, `missing ${name}`);
  return match[1];
}

test("fashion parser versions stay synced across parser, drift gate, and debug reparse route", () => {
  const parser = readFileSync("src/lib/parsers/wave92-fashion-mobility.ts", "utf-8");
  const tickPipeline = readFileSync("src/lib/tick-pipeline.ts", "utf-8");
  const debugReparseRoute = readFileSync("src/app/api/debug/reparse-listings/route.ts", "utf-8");
  const optionParser = readFileSync("src/lib/option-parser.ts", "utf-8");

  const shoeVersion = quotedConst(parser, "PARSER_VERSION_W92_SHOE_V8");
  const clothingVersion = quotedConst(parser, "PARSER_VERSION_W216_CLOTHING_LATEST");
  const genericVersion = quotedConst(optionParser, "PARSER_VERSION");

  assert.match(tickPipeline, new RegExp(`shoe:\\s*"${shoeVersion}"`));
  assert.match(tickPipeline, new RegExp(`clothing:\\s*"${clothingVersion}"`));
  assert.match(debugReparseRoute, new RegExp(`categoryFilter === "shoe" \\? "${shoeVersion}"`));
  assert.match(debugReparseRoute, new RegExp(`categoryFilter === "clothing" \\? "${clothingVersion}"`));
  assert.match(tickPipeline, /reason === `stale_parser_version_\$\{category\}`/);
  assert.match(tickPipeline, /reason === `stale_parser_version_\$\{category\}_residue`/);
  assert.match(tickPipeline, /fashionReserveLimit/);
  assert.match(tickPipeline, /FASHION_SCORE_RESERVE_FILTERS/);
  assert.match(tickPipeline, /"&sku_id=gte\.shoe-&sku_id=lt\.shoe\."/);
  assert.match(tickPipeline, /"&sku_id=gte\.clothing-&sku_id=lt\.clothing\."/);
  assert.match(tickPipeline, /scanLimitMax:\s*40/);
  assert.match(tickPipeline, /scanLimitMax:\s*10/);
  assert.match(tickPipeline, /PARSER_VERSION as OPTION_PARSER_VERSION/);
  for (const category of [
    "camera",
    "desktop",
    "drone",
    "earphone",
    "game_console",
    "home_appliance",
    "kickboard",
    "laptop",
    "lego",
    "monitor",
    "perfume",
    "smartphone",
    "smartwatch",
    "speaker",
    "sport_golf",
    "tablet",
    "watch",
  ]) {
    assert.match(tickPipeline, new RegExp(`${category}:\\s*OPTION_PARSER_VERSION`), `${category} latest drift target should follow ${genericVersion}`);
  }
  assert.match(tickPipeline, /parser_version=neq\.\$\{encodeURIComponent\(latestVersion\)\}[\s\S]*headers: serviceHeaders\(\)/);
});

test("score-stage optional fraud hash guard has a bounded fallback timeout", () => {
  const tickPipeline = readFileSync("src/lib/tick-pipeline.ts", "utf-8");

  assert.match(tickPipeline, /PIPELINE_FRAUD_GROUP_HASH_TIMEOUT_MS/);
  assert.match(tickPipeline, /AbortSignal\.timeout/);
  assert.match(tickPipeline, /loadFraudGroupHashes failed \(non-fatal\)/);
  assert.match(tickPipeline, /invalidated_reason=like\.lane_blocked_\*&limit=2000`[\s\S]*headers: serviceHeaders\(\)/);
});
