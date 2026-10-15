const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const isWatch = process.argv.includes("--watch");
const isProd = process.argv.includes("--prod");

// `--metafile=<path>` writes the esbuild metafile; `--analyze` also prints a
// size breakdown. Both were previously accepted but silently ignored, so
// `npm run analyze` produced no meta.json and there was no way to see what is
// actually inside dist/main.js. main.js is subject to Obsidian Sync's per-file
// limit (5 MB on the Standard plan), so this visibility is load-bearing.
const metafileArg = process.argv.find((arg) => arg.startsWith("--metafile="));
const metafilePath = metafileArg ? metafileArg.slice("--metafile=".length) : null;
const isAnalyze = process.argv.includes("--analyze");

const rootDir = path.resolve(__dirname, "..");
const outdir = path.join(rootDir, "dist");
const entry = path.join(rootDir, "src", "main.ts");

function writeInfo(message) {
  process.stdout.write(`${String(message)}\n`);
}

function writeError(error) {
  const text = error instanceof Error ? (error.stack || error.message) : String(error);
  process.stderr.write(`${text}\n`);
}

// Obsidian provides the "obsidian" module at runtime.
// Mark it external so esbuild doesn't try to bundle it.
// Also mark CSS as external so it doesn't generate main.css
// @codemirror/* must also be external — Obsidian bundles them and
// duplicating them breaks instanceof checks in CM6.
const external = ["obsidian", "*.css", "@codemirror/state", "@codemirror/view"];

function formatBytes(bytes) {
  return `${bytes.toLocaleString("en-US")} B (${(bytes / 1024).toFixed(0)} KB)`;
}

/**
 * Inline `.wasm` files as *deflated* base64 rather than raw base64.
 *
 * esbuild's built-in `binary` loader base64-encodes the file verbatim, which
 * costs 4/3 of the raw size. sql.js ships a 660 KB WASM binary, so the default
 * path parked ~880 KB of base64 inside main.js - 17% of the bundle - for a
 * feature (Anki .apkg import) that most sessions never touch. Deflate first and
 * the same payload costs ~429 KB.
 *
 * This matters because main.js is copied into .obsidian/plugins/learnkit/ and
 * Obsidian Sync enforces a per-file limit (5 MB on the Standard plan). See
 * tooling/check-bundle-size.mjs.
 *
 * The emitted value is still a Uint8Array so consumers keep the same shape; the
 * only contract change is that the bytes are now a zlib stream, so callers must
 * unzlibSync() before handing them to whatever wants the real binary.
 * anki-sql.ts is the only consumer.
 */
const deflateWasmPlugin = {
  name: "deflate-wasm-inline",
  setup(build) {
    build.onLoad({ filter: /\.wasm$/ }, (args) => {
      const raw = fs.readFileSync(args.path);
      const deflated = zlib.deflateSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
      const base64 = deflated.toString("base64");
      return {
        loader: "js",
        contents:
          `// ${path.basename(args.path)}: ${formatBytes(raw.length)} raw -> ` +
          `${formatBytes(deflated.length)} deflated (inlined as base64 by build)\n` +
          `const base64 = ${JSON.stringify(base64)};\n` +
          `const bytes = typeof Buffer !== "undefined"\n` +
          `  ? new Uint8Array(Buffer.from(base64, "base64"))\n` +
          `  : Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));\n` +
          `export default bytes;\n`,
      };
    });
  },
};

/**
 * Group metafile inputs into buckets so the report answers the question we
 * actually have: which dependency, or which of our own folders, is eating the
 * bundle. Nested `node_modules/a/node_modules/b` is attributed to the outermost
 * package, which is deliberate — we want "who pulled this in".
 */
function bucketOf(inputPath) {
  if (inputPath.startsWith("node_modules/")) {
    const parts = inputPath.split("/");
    const pkg = parts[1].startsWith("@") ? `${parts[1]}/${parts[2]}` : parts[1];
    return `node_modules/${pkg}`;
  }
  const parts = inputPath.split("/");
  if (parts.length <= 1) return inputPath;
  if (parts.length <= 4) return parts.slice(0, -1).join("/") || inputPath;
  return parts.slice(0, 3).join("/");
}

function analyzeMetafile(metafile, outfile) {
  const buckets = new Map();
  let total = 0;

  for (const output of Object.values(metafile.outputs)) {
    for (const [input, data] of Object.entries(output.inputs || {})) {
      const bytes = data.bytesInOutput;
      if (!bytes) continue;
      const key = bucketOf(input);
      buckets.set(key, (buckets.get(key) || 0) + bytes);
      total += bytes;
    }
  }

  let own = 0;
  let deps = 0;
  for (const [key, bytes] of buckets) {
    if (key.startsWith("node_modules")) deps += bytes;
    else own += bytes;
  }

  const outSize = fs.existsSync(outfile) ? fs.statSync(outfile).size : 0;
  const rows = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

  writeInfo("");
  writeInfo("Bundle contents (bytes contributed to the output)");
  writeInfo(`${"bucket".padEnd(46)} ${"KB".padStart(9)} ${"%".padStart(7)}`);
  writeInfo("-".repeat(64));
  for (const [key, bytes] of rows) {
    writeInfo(`${key.padEnd(46)} ${(bytes / 1024).toFixed(0).padStart(9)} ${((bytes / total) * 100).toFixed(1).padStart(6)}%`);
  }
  writeInfo("-".repeat(64));
  writeInfo(`${"own source (src/)".padEnd(46)} ${(own / 1024).toFixed(0).padStart(9)} ${((own / total) * 100).toFixed(1).padStart(6)}%`);
  writeInfo(`${"dependencies (node_modules/)".padEnd(46)} ${(deps / 1024).toFixed(0).padStart(9)} ${((deps / total) * 100).toFixed(1).padStart(6)}%`);
  writeInfo("");
  writeInfo(`output            : ${path.relative(rootDir, outfile)}`);
  writeInfo(`on-disk size      : ${formatBytes(outSize)}`);
  writeInfo(`Obsidian Sync cap : 5 MB/file on the Standard plan (5,242,880 B = 5 MiB)`);
  writeInfo(`headroom vs 5 MiB : ${formatBytes(5242880 - outSize)}`);
  writeInfo("");
}

async function build() {
  const ctx = await esbuild.context({
    entryPoints: [entry],
    bundle: true,
    format: "cjs",
    // es2020 keeps optional chaining (?.) and nullish coalescing (??) instead of
    // downlevelling them, which is worth ~79 KB of main.js. Safe because
    // Obsidian's own shipped bundle uses ?. 1,894x, ?? 1,236x and ||= 116x, so
    // any runtime that can execute Obsidian can execute this.
    target: "es2020",
    platform: "node",
    sourcemap: "external",
    minify: isProd,
    outfile: path.join(outdir, "main.js"),
    external,
    logLevel: "info",
    plugins: [deflateWasmPlugin],

    // Only ask esbuild for a metafile when a caller wants one, so the default
    // build path is unaffected.
    metafile: Boolean(metafilePath),

    // Replace process.env.NODE_ENV at build time so it works on mobile
    // (Obsidian mobile runs in a Capacitor WebView with no Node.js globals)
    define: {
      "process.env.NODE_ENV": isProd ? '"production"' : '"development"',
    },

    // ✅ Add these two lines anywhere inside this object
    jsx: "automatic",
    // NOTE: no ".wasm" entry here on purpose - deflateWasmPlugin above owns
    // .wasm and inlines it deflated. Adding it back would shadow the plugin.
    loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json", ".svg": "text" },

    banner: {
      js:
        "/*\n" +
        "  Sprout — Obsidian Plugin (bundled with esbuild)\n" +
        "  Output: dist/main.js\n" +
        "*/",
    },
  });

  if (isWatch) {
    await ctx.watch();
    writeInfo("Watching... (dist/main.js)");
    return;
  }

  const result = await ctx.rebuild();
  await ctx.dispose();

  if (metafilePath && result && result.metafile) {
    const absolute = path.isAbsolute(metafilePath) ? metafilePath : path.join(rootDir, metafilePath);
    fs.writeFileSync(absolute, JSON.stringify(result.metafile));
    writeInfo(`Metafile: ${path.relative(rootDir, absolute)}`);
    if (isAnalyze) analyzeMetafile(result.metafile, path.join(outdir, "main.js"));
  }

  writeInfo("Built: dist/main.js");
}

build().catch((err) => {
  writeError(err);
  process.exit(1);
});
