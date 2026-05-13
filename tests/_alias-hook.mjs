// Module-resolution hook that maps the `@/...` tsconfig path alias to
// `<repo>/src/...`. Loaded by `_alias-loader.mjs` via `register()`.

import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

let SRC_ROOT = null;

export function initialize(data) {
  SRC_ROOT = data?.srcRoot ?? null;
}

const TRY_EXTS = [".ts", ".tsx", ".mts", ".mjs", ".js", "/index.ts", "/index.js"];

function resolveAlias(specifier) {
  if (!SRC_ROOT) return null;
  if (!specifier.startsWith("@/")) return null;
  const rel = specifier.slice(2);
  const base = path.resolve(SRC_ROOT, rel);
  for (const ext of TRY_EXTS) {
    const candidate = ext.startsWith("/") ? path.join(base, ext.slice(1)) : base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return base;
}

export async function resolve(specifier, context, nextResolve) {
  const aliased = resolveAlias(specifier);
  if (!aliased) return nextResolve(specifier, context);
  return nextResolve(pathToFileURL(aliased).href, context);
}
