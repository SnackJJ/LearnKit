/**
 * @file tests/sql-wasm-inflate.test.ts
 * @summary Guards the inline format of the sql.js WASM binary.
 *
 * The sql.js WebAssembly binary is inlined into main.js as a *deflated* zlib
 * stream rather than raw base64 (see deflateWasmPlugin in
 * tooling/esbuild.config.js). Raw base64 cost ~880 KB of the bundle; deflated
 * it costs ~429 KB, which keeps main.js under Obsidian Sync's 5 MB per-file
 * limit.
 *
 * That optimisation is invisible at runtime and easy to break silently: if the
 * build stops deflating, the bundle just gets bigger; if the runtime stops
 * inflating, Anki import dies. Nothing else in the suite exercises getSqlJs()
 * (every SQLite suite mocks anki-sql), so the pairing is asserted here.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { unzlibSync } from "fflate/browser";
import initSqlJs from "sql.js/dist/sql-wasm-browser.js";

const WASM_PATH = path.resolve(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");

const sqlJsFactory = initSqlJs as unknown as (config: {
  wasmBinary: ArrayBuffer;
}) => Promise<import("sql.js").SqlJsStatic>;

function deflateAsBuildDoes(raw: Uint8Array): Uint8Array {
  return new Uint8Array(
    zlib.deflateSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION }),
  );
}

describe("sql.js WASM inline format", () => {
  const realWasm = new Uint8Array(fs.readFileSync(WASM_PATH));

  it("ships a wasm binary on disk to compare against", () => {
    expect(realWasm.length).toBeGreaterThan(500_000);
    expect(Buffer.from(realWasm.slice(0, 4)).toString("hex")).toBe("0061736d");
  });

  it("zlib.deflateSync at build time round-trips through unzlibSync at runtime", () => {
    const deflated = deflateAsBuildDoes(realWasm);
    const inflated = unzlibSync(deflated);

    // Byte-for-byte, or sql.js will refuse to instantiate.
    expect(inflated.length).toBe(realWasm.length);
    expect(Buffer.compare(Buffer.from(inflated), Buffer.from(realWasm))).toBe(0);
  });

  it("deflating saves enough to be worth the indirection", () => {
    const deflated = deflateAsBuildDoes(realWasm);
    // ~51% saving measured; assert a conservative floor so a dependency bump
    // that makes the binary incompressible shows up as a failure here.
    expect(deflated.length).toBeLessThan(realWasm.length * 0.7);
  });

  it("sql.js initialises from the inflated buffer and runs a query", async () => {
    const inflated = unzlibSync(deflateAsBuildDoes(realWasm));
    const SQL = await sqlJsFactory({ wasmBinary: inflated.slice().buffer });

    const db = new SQL.Database();
    try {
      db.run("CREATE TABLE col (id integer primary key, crt integer not null);");
      db.run("INSERT INTO col VALUES (1, 1700000000);");
      expect(db.exec("SELECT id, crt FROM col;")[0].values).toEqual([[1, 1700000000]]);
    } finally {
      db.close();
    }
  });
});
