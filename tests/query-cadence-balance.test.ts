import assert from "node:assert/strict";
import test from "node:test";

import { categoryFromComparableKey } from "@/lib/category-readiness";
import { getCategoryPageOverrides, loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { queryFamily } from "@/lib/search-query-cadence";
import { interleaveSearchQueriesByFamilyForTest, rotateDeepCrawlQueriesForTest } from "@/lib/tick-pipeline";

test("public category sweep no longer deep-crawls shoes in the regular freshness loop", () => {
  const overrides = getCategoryPageOverrides();
  assert.equal(overrides["category:405"]?.length, 3);
  assert.equal(overrides["category:600700"]?.length, 2);
  assert.equal(overrides["category:600500"]?.length, 2);
});

test("catalog and audio query families avoid falling into unknown gather cadence", () => {
  assert.equal(queryFamily("비츠 솔로4"), "earphone");
  assert.equal(queryFamily("WH-1000XM"), "earphone");
  assert.equal(queryFamily("보스 QC"), "earphone");
  assert.equal(queryFamily("JBL Flip 6"), "speaker");
  assert.equal(queryFamily("PS5 슬림"), "game_console");
  assert.equal(queryFamily("로보락 S8"), "home_appliance");
  assert.equal(queryFamily("덩크 로우"), "shoe");
});

test("due query ordering interleaves families instead of letting one category monopolize the tick budget", () => {
  const ordered = interleaveSearchQueriesByFamilyForTest([
    "덩크 로우",
    "아디다스 토바코",
    "호카 본디 9",
    "아이폰 13",
    "에어팟 프로2",
    "애플워치 9",
  ]);

  assert.deepEqual(ordered.slice(0, 4), [
    "덩크 로우",
    "아이폰 13",
    "에어팟 프로2",
    "애플워치 9",
  ]);
});

test("deep crawl rotates a bounded query window instead of scanning the full catalog each run", () => {
  const queries = Array.from({ length: 10 }, (_, index) => `q${index}`);

  assert.deepEqual(rotateDeepCrawlQueriesForTest(queries, 4, 0), ["q0", "q1", "q2", "q3"]);
  assert.deepEqual(rotateDeepCrawlQueriesForTest(queries, 4, 30 * 60 * 1000), ["q4", "q5", "q6", "q7"]);
  assert.deepEqual(rotateDeepCrawlQueriesForTest(queries, 4, 60 * 60 * 1000), ["q8", "q9", "q0", "q1"]);
});

test("deep crawl default query window keeps serverless post-processing below the route ceiling", () => {
  const config = loadPipelineRuntimeConfig();
  assert.equal(config.deepCrawlQueryLimit, 40);
  assert.equal(config.deepCrawlDetailTriageLimit, 200);
});

test("newer public categories are inferable from comparable keys for pack diversity", () => {
  assert.equal(categoryFromComparableKey("shoe|dunk_low|270|a_grade"), "shoe");
  assert.equal(categoryFromComparableKey("clothing|polo|m|a_grade"), "clothing");
  assert.equal(categoryFromComparableKey("drone|dji_mini_4_pro|fly_more"), "drone");
});
