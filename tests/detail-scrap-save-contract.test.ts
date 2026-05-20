import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal exposes a right-aligned scrap save button in both nav states", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /data-scrap-save-button/);
  assert.match(modal, /aria-label=\{label\}/);
  assert.match(modal, /aria-pressed=\{saved\}/);
  assert.match(modal, /absolute right-3 top-3 z-20/);
  assert.match(modal, /items-center justify-between gap-1 px-3 py-2/);
  assert.match(modal, /minyoi_saved_reveal_pids_v1/);
});

test("scrap save persists through the reveal save endpoint as watching feedback", () => {
  const route = source("src/app/api/packs/reveals/save/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const meRoute = source("src/app/api/packs/me/route.ts");

  assert.match(route, /feedbackType: "watching"/);
  assert.match(route, /feedback_type=eq\.watching/);
  assert.match(route, /assertVisibleRevealOwnership/);
  assert.match(meRoute, /savedFeedbackByPid/);
  assert.match(dashboard, /onSaveToggle=\{handleSaveToggle\}/);
  assert.match(dashboard, /\/api\/packs\/reveals\/save/);
});
