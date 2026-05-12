// Bootstraps the `@/...` path-alias hook for `node --test`.
//
// Usage:
//   node --experimental-strip-types --import ./tests/_alias-loader.mjs \
//        --test tests/core-rules.test.ts

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "..", "src");

register("./_alias-hook.mjs", import.meta.url, { data: { srcRoot } });
