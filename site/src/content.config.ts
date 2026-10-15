import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readSlug(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const slug = (data as { slug?: unknown }).slug;
  return isNonEmptyString(slug) ? slug : null;
}

function preserveDocsPath(entry: string) {
  const normalized = String(entry).replace(/\\/g, "/");
  const withoutExtension = normalized.replace(/\.(markdown|mdown|mkdn|mkd|mdwn|md|mdx)$/i, "");
  return withoutExtension.replace(/\/index$/i, "");
}

/*
 * Astro and Starlight publish their loader/schema types as build-time-generated
 * declarations. In an environment where this site's own dependencies are not
 * installed (the plugin review sandbox only installs the repository root), those
 * imports resolve to `any` and every call through them trips
 * no-unsafe-call / no-unsafe-assignment.
 *
 * The suppressions below are scoped to the object literal that actually trips
 * them. The previous eslint-disable-next-line comments sat on the *import* lines
 * and the `export const` line, so they never applied to the reported ranges and
 * the warnings kept firing.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Astro/Starlight loader + schema types are generated at build time; unresolved they are `any` */
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: "./src/content/docs",
      pattern: "**/[^_]*.{markdown,mdown,mkdn,mkd,mdwn,md,mdx}",
      generateId: ({ entry, data }: { entry: string; data: Record<string, unknown> }) => {
        const slug = readSlug(data);
        if (slug) return slug;
        return preserveDocsPath(entry);
      },
    }),
    schema: docsSchema(),
  }),
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
