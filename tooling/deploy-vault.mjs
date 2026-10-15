#!/usr/bin/env node
/**
 * Install the built plugin into an Obsidian vault.
 *
 *   node tooling/deploy-vault.mjs "/path/to/Vault"
 *
 * Copies dist/main.js, dist/manifest.json, dist/styles.css and dist/locales/
 * into <vault>/.obsidian/plugins/learnkit/, then verifies every file is
 * byte-identical to dist/ so a partial or stale copy cannot pass silently.
 *
 * Deliberately does NOT touch data.json — that is the user's settings.
 * Deliberately does NOT copy main.js.map — it is ~15 MB, and Obsidian Sync caps
 * files at 5 MB on the Standard plan, so it can never reach another device.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const PLUGIN_ID = "learnkit";

const vault = process.argv[2];
if (!vault) {
  console.error("usage: node tooling/deploy-vault.mjs \"/path/to/Vault\"");
  process.exit(1);
}

const resolvedVault = path.resolve(vault.replace(/^~/, process.env.HOME ?? "~"));
if (!fs.existsSync(resolvedVault)) {
  console.error(`✗ vault does not exist: ${resolvedVault}`);
  process.exit(1);
}

const manageDir = path.join(resolvedVault, ".obsidian");
if (!fs.existsSync(manageDir)) {
  console.warn(`⚠ ${resolvedVault} has no .obsidian/ folder - is it really a vault?`);
}

const targetDir = path.join(manageDir, "plugins", PLUGIN_ID);

/** Files copied as-is; locales/ is copied recursively. */
const FILES = ["main.js", "manifest.json", "styles.css"];
const DIRS = ["locales"];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Refuse to deploy a stale or missing build.
for (const name of FILES) {
  if (!fs.existsSync(path.join(distDir, name))) {
    console.error(`✗ dist/${name} is missing. Run \`npm run build\` first.`);
    process.exit(1);
  }
}

fs.mkdirSync(targetDir, { recursive: true });

const installed = [];
for (const name of FILES) {
  fs.copyFileSync(path.join(distDir, name), path.join(targetDir, name));
  installed.push(name);
}
for (const name of DIRS) {
  const from = path.join(distDir, name);
  if (!fs.existsSync(from)) continue;
  fs.rmSync(path.join(targetDir, name), { recursive: true, force: true });
  fs.cpSync(from, path.join(targetDir, name), { recursive: true });
  installed.push(`${name}/`);
}

// Verify: every deployed file must match dist byte-for-byte.
let failures = 0;
for (const name of FILES) {
  const a = sha256(path.join(distDir, name));
  const b = sha256(path.join(targetDir, name));
  const ok = a === b;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
}
for (const name of DIRS) {
  const fromDir = path.join(distDir, name);
  if (!fs.existsSync(fromDir)) continue;
  for (const entry of fs.readdirSync(fromDir)) {
    const a = sha256(path.join(fromDir, entry));
    const b = sha256(path.join(targetDir, name, entry));
    const ok = a === b;
    if (!ok) failures += 1;
    console.log(`  ${ok ? "✓" : "✗"} ${name}/${entry}`);
  }
}

const size = fs.statSync(path.join(targetDir, "main.js")).size;
console.log(`\ndeployed to ${targetDir}`);
console.log(`main.js ${size.toLocaleString("en-US")} B (${(size / 1024).toFixed(0)} KB)`);

if (failures > 0) {
  console.error(`\n✗ ${failures} file(s) did not match dist/ - the deploy is not trustworthy.`);
  process.exit(1);
}
console.log("\n✓ all files verified against dist/");
