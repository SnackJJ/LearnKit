#!/usr/bin/env node
/**
 * Bundle size budget gate.
 *
 * Why this exists: `dist/main.js` is copied into `.obsidian/plugins/learnkit/`
 * and Obsidian Sync syncs the configuration folder by default. Obsidian Sync
 * enforces a per-file limit — 5 MB on the Standard plan, 200 MB on Plus
 * (https://help.obsidian.md/sync/faq — "How large can each file be?").
 * A main.js over that limit silently never reaches the user's other devices,
 * so the plugin "works on my machine" and is missing on mobile.
 *
 * Usage:
 *   node tooling/check-bundle-size.mjs [path-to-main.js]
 *
 * Exit codes: 0 = within budget, 1 = over the hard limit.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Hard limit: exceeds this and the file never syncs on the Standard plan.
// "5 MB" is ambiguous (5,000,000 B vs 5,242,880 B). We enforce the stricter
// reading so we are safe either way. This threshold is also the regression
// guard for the inlined sql.js WASM: shipping it as raw base64 instead of
// deflated adds ~440 KB, which pushes main.js over this line and fails here.
const MAX_BYTES = 5_000_000;
// Soft limit: warn while there is still room to react.
const WARN_BYTES = 4_800_000;

const target = path.resolve(rootDir, process.argv[2] ?? "dist/main.js");

if (!fs.existsSync(target)) {
  console.error(`✗ size gate: ${path.relative(rootDir, target)} does not exist (run \`npm run build\` first)`);
  process.exit(1);
}

const size = fs.statSync(target).size;
const kb = (n) => `${n.toLocaleString("en-US")} B (${(n / 1024).toFixed(1)} KB)`;

// Report the whole footprint that lands in the vault, not just main.js.
const companions = ["dist/styles.css", "dist/manifest.json"];
console.log(`size gate: ${path.relative(rootDir, target)} = ${kb(size)}`);
let vaultTotal = size;
for (const rel of companions) {
  const abs = path.join(rootDir, rel);
  if (!fs.existsSync(abs)) continue;
  const s = fs.statSync(abs).size;
  vaultTotal += s;
  console.log(`          + ${rel} = ${kb(s)}`);
}
console.log(`          = ${kb(vaultTotal)} installed in the vault`);
console.log(`          hard limit ${kb(MAX_BYTES)} — headroom ${size > MAX_BYTES ? "-" : ""}${kb(Math.abs(MAX_BYTES - size))}`);

if (size > MAX_BYTES) {
  console.error(
    `\n✗ FAIL: ${path.relative(rootDir, target)} is ${(size / 1024 / 1024).toFixed(3)} MiB, over the ` +
      `${(MAX_BYTES / 1024 / 1024).toFixed(0)} MiB Obsidian Sync per-file limit.\n` +
      `  This file will NOT sync to the user's other devices. Run \`npm run analyze\` to see what grew.`,
  );
  process.exit(1);
}

if (size > WARN_BYTES) {
  console.warn(
    `\n⚠ WARN: ${kb(size)} exceeds ${kb(WARN_BYTES)}. Under the 5 MiB reading this still syncs, but there is ` +
      `very little headroom left. Run \`npm run analyze\` before adding dependencies.`,
  );
}

console.log("\n✓ size gate passed");
