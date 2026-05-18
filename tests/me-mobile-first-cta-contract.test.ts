import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/me mobile prioritizes welcome/products before secondary activity tools", () => {
  const meClient = source("src/components/me-dashboard-client.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const feedbackActivity = source("src/components/my-feedback-activity.tsx");
  const productIndex = meClient.indexOf("<UserRevealDashboard");
  const feedbackIndex = meClient.indexOf("<MyFeedbackActivity");

  assert.ok(productIndex >= 0 && feedbackIndex > productIndex);
  assert.match(feedbackActivity, /hidden h-24 .*sm:block/);
  assert.match(feedbackActivity, /hidden rounded-xl .*sm:block/);
  assert.match(dashboard, /shouldShowListTools/);
  assert.match(dashboard, /검색\/정렬/);
  assert.match(dashboard, /hidden flex-col gap-2 sm:flex/);
  assert.match(dashboard, /mx-3 flex flex-wrap .*sm:hidden/);
  assert.match(dashboard, /shouldShowListTools \? \(/);
});
