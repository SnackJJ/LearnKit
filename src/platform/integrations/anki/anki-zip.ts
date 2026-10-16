/**
 * @file src/anki/anki-zip.ts
 * @summary ZIP pack/unpack for Anki .apkg files using fflate.
 *
 * An .apkg is a ZIP archive containing one collection database plus optional
 * media. Which database it carries depends on the Anki version that wrote it,
 * and a 2.1.62+ export ships BOTH a current database and a stub legacy one:
 *
 *   - `collection.anki21b` — Anki 2.1.62+, zstd-compressed SQLite (the real data)
 *   - `collection.anki21`  — Anki 2.1.28+, plain SQLite, schema v18
 *   - `collection.anki2`   — legacy SQLite, schema v11. In a 2.1.62+ export this
 *                            holds only Anki's "Please update to the latest Anki
 *                            version" placeholder note, so it must never be
 *                            preferred over a newer database.
 *   - `media`              — a JSON file mapping numeric keys to filenames
 *   - `0`, `1`, `2`, …     — the actual media files, named by index
 *
 * @exports
 *  - packApkg   — build a .apkg from SQLite bytes + media
 *  - unpackApkg — extract SQLite bytes + media from an .apkg
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate/browser";
import { decompress as zstdDecompress } from "fzstd";

/**
 * Collection databases in preference order (most current first). Taking the
 * first name the ZIP happens to list is what made a 2.1.62+ export import as a
 * single "update Anki" card: that entry is the stub `collection.anki2`.
 */
const COLLECTION_NAMES_BY_PREFERENCE = [
  "collection.anki21b",
  "collection.anki21",
  "collection.anki2",
] as const;

const SQLITE_MAGIC = "SQLite format 3\0";

function startsWithSqliteMagic(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_MAGIC.length) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/** Entry names that could be a collection database, best candidate first. */
function rankCollectionEntries(names: string[]): string[] {
  const ranked: string[] = [];
  const push = (name: string) => {
    if (!ranked.includes(name)) ranked.push(name);
  };
  for (const preferred of COLLECTION_NAMES_BY_PREFERENCE) {
    for (const name of names) {
      if (name === preferred || name.endsWith(`/${preferred}`)) push(name);
    }
  }
  // Names we do not know, but that still look like a database, get a chance too.
  for (const suffix of COLLECTION_NAMES_BY_PREFERENCE) {
    for (const name of names) {
      if (name.endsWith(suffix)) push(name);
    }
  }
  return ranked;
}

/**
 * Decodes a collection database, transparently inflating the zstd container the
 * newer Anki format uses. Throws a message the UI can show as-is.
 */
function decodeCollectionBytes(name: string, bytes: Uint8Array): Uint8Array {
  if (startsWithSqliteMagic(bytes)) return bytes;
  try {
    const inflated = zstdDecompress(bytes);
    if (startsWithSqliteMagic(inflated)) return inflated;
  } catch {
    // Fall through to the shared error below.
  }
  throw new Error(
    `Invalid Anki file: ${name} is neither a SQLite database nor a readable zstd container.`,
  );
}

/**
 * Pack an Anki .apkg file from SQLite database bytes and optional media files.
 */
export function packApkg(
  sqliteBytes: Uint8Array,
  media: Map<string, Uint8Array> = new Map(),
): Uint8Array {
  const files: Record<string, Uint8Array> = {};

  files["collection.anki2"] = sqliteBytes;

  // Build the media manifest and add media files
  const mediaManifest: Record<string, string> = {};
  let idx = 0;
  for (const [filename, bytes] of media) {
    const key = String(idx);
    mediaManifest[key] = filename;
    files[key] = bytes;
    idx++;
  }

  files["media"] = strToU8(JSON.stringify(mediaManifest));

  return zipSync(files, { level: 6 });
}

/**
 * Unpack an .apkg file into SQLite database bytes and a media file map.
 */
export function unpackApkg(
  apkgBytes: Uint8Array,
): { db: Uint8Array; media: Map<string, Uint8Array> } {
  const filesRaw = unzipSync(apkgBytes) as unknown;
  if (!filesRaw || typeof filesRaw !== "object") {
    throw new Error("Invalid Anki file: unzip failed");
  }
  const files = filesRaw as Record<string, Uint8Array>;

  const candidates = rankCollectionEntries(Object.keys(files));
  if (candidates.length === 0) {
    throw new Error("Invalid Anki file: no .anki2 database found");
  }

  // Decode in preference order. A candidate that decodes is the collection; one
  // that does not is only skipped if we have not already committed to a newer
  // format, so a truncated modern export fails loudly instead of importing the
  // placeholder database that ships alongside it.
  let db: Uint8Array | null = null;
  for (const name of candidates) {
    const bytes = files[name];
    if (!bytes) continue;
    const looksModern = name.endsWith("anki21b");
    if (looksModern) {
      db = decodeCollectionBytes(name, bytes);
      break;
    }
    if (startsWithSqliteMagic(bytes)) {
      db = bytes;
      break;
    }
  }
  if (!db) {
    // Nothing looked like SQLite. A single entry is passed through for the
    // SQLite layer to complain about; with several candidates the archive is
    // malformed and the user needs a message that says so.
    db =
      candidates.length === 1
        ? files[candidates[0]]
        : decodeCollectionBytes(candidates[0], files[candidates[0]]);
  }

  // Parse the media manifest and collect media blobs
  const media = new Map<string, Uint8Array>();
  const mediaManifestBytes = files["media"];
  if (mediaManifestBytes) {
    try {
      const manifest = JSON.parse(strFromU8(mediaManifestBytes)) as Record<string, string>;
      for (const [numKey, filename] of Object.entries(manifest)) {
        const mediaBytes = files[numKey];
        if (mediaBytes) {
          media.set(filename, mediaBytes);
        }
      }
    } catch {
      // Malformed media manifest — skip media
    }
  }

  return { db, media };
}
