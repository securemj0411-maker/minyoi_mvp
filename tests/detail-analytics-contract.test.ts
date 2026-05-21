import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail analytics records detail/easy-mode funnel events server-side only", () => {
  const migration = source("supabase/migrations/20260521094703_detail_analytics_events.sql");
  const route = source("src/app/api/packs/reveals/events/route.ts");
  const analytics = source("src/lib/detail-analytics.ts");
  const explore = source("src/components/explore-client.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");
  const adminPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/detail-events/page.tsx");

  assert.match(migration, /create table if not exists public\.mvp_detail_events/);
  assert.match(migration, /user_ref text not null/);
  assert.match(migration, /pid bigint not null references public\.mvp_raw_listings\(pid\)/);
  assert.match(migration, /alter table public\.mvp_detail_events enable row level security/);
  assert.match(migration, /using \(false\)/);

  assert.match(analytics, /detail_opened/);
  assert.match(analytics, /easy_mode_completed/);
  assert.match(analytics, /original_clicked/);
  assert.match(analytics, /free_limit_paywall_shown/);

  assert.match(route, /requireSupabaseUser/);
  assert.match(route, /userRefForAuthUser\(auth\.user\.id\)/);
  assert.match(route, /isDetailEventType/);
  assert.match(route, /tableUrl\("mvp_detail_events"\)/);
  assert.doesNotMatch(route, /user_ref:\s*payload/);

  assert.match(explore, /trackDetailEvent/);
  assert.match(explore, /"detail_opened"/);
  assert.match(explore, /"free_limit_paywall_shown"/);
  assert.match(explore, /"scrap_saved"/);
  assert.match(explore, /"related_clicked"/);

  assert.match(modal, /onTrackEvent/);
  assert.match(modal, /"easy_mode_step_view"/);
  assert.match(modal, /"easy_mode_completed"/);
  assert.match(modal, /"detail_report_opened"/);
  assert.match(modal, /"original_clicked"/);

  assert.match(adminPage, /상세 움직임 보기/);
  assert.match(adminPage, /mvp_detail_events/);
  assert.match(adminPage, /원본 클릭률/);
});
