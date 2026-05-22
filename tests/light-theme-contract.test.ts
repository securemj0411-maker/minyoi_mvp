import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("light mode uses Toss-like neutral background and blue action tokens", () => {
  const globals = source("src/app/globals.css");
  const layout = source("src/app/layout.tsx");
  const explore = source("src/components/explore-client.tsx");
  const nav = source("src/components/app-nav.tsx");
  const footer = source("src/components/app-footer.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");
  const preview = source("src/components/preview-masked-dashboard.tsx");
  const howItWorks = source("src/app/how-it-works/page.tsx");
  const meDashboard = source("src/components/me-dashboard-client.tsx");

  assert.match(globals, /--background: #f5f7fb/);
  assert.match(globals, /--foreground: #191f28/);
  assert.match(globals, /--brand-accent: #3182f6/);
  assert.match(globals, /--brand-accent-strong: #3182f6/);
  assert.match(globals, /--brand-cream: #ffffff/);
  assert.match(globals, /html:not\(\.dark\) \.bg-\\\[\\#f6f1e8\\\]/);
  assert.match(globals, /html:not\(\.dark\) \.bg-\\\[\\#fffbf4\\\]/);
  assert.match(globals, /html:not\(\.dark\) \.border-\\\[\\#e2d9cb\\\]/);
  assert.match(globals, /html:not\(\.dark\) \.text-\\\[\\#223127\\\]/);
  assert.match(layout, /color: "#f5f7fb"/);
  assert.match(explore, /bg-\[\#f5f7fb\]/);
  assert.match(explore, /#f5f7fb_34%/);

  const lightSurfaceFiles = [
    ["app-nav", nav],
    ["app-footer", footer],
    ["pack-reveal-modal", modal],
    ["preview-masked-dashboard", preview],
    ["how-it-works", howItWorks],
    ["me-dashboard", meDashboard],
  ] as const;

  for (const [name, text] of lightSurfaceFiles) {
    assert.doesNotMatch(text, /bg-\[#(?:f8f4ec|fbf8f2|fffbf4|fffaf1|f6f1e8|ebe6dc)\]/, `${name} should not paint beige backgrounds directly`);
    assert.doesNotMatch(text, /border-\[#(?:e2d9cb|ddd4c7|e7dece|eee5d8|ece3d2)\]/, `${name} should not paint beige borders directly`);
  }

  for (const [name, text] of [
    ["app-nav", nav],
    ["how-it-works", howItWorks],
    ["me-dashboard", meDashboard],
  ] as const) {
    assert.doesNotMatch(text, /#(?:29382f|314238|5d735f|4f6f58|9fb49c|b9c9b9|edf3eb)/i, `${name} should not use old green theme hexes directly`);
  }
});
