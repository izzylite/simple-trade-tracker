import { assertEquals } from "jsr:@std/assert@1";
import { normalizeImpact, resolveImpact } from "./impact.ts";

Deno.test("normalizeImpact canonicalizes case and trims", () => {
  assertEquals(normalizeImpact("high"), "High");
  assertEquals(normalizeImpact("  Medium "), "Medium");
  assertEquals(normalizeImpact("LOW"), "Low");
  assertEquals(normalizeImpact(""), null);
  assertEquals(normalizeImpact(null), null);
  assertEquals(normalizeImpact("3 bulls"), null);
});

Deno.test("resolveImpact: placeholder Low is corrected up to scraped High (NFP bug)", () => {
  // The exact regression: Nonfarm Payrolls stored as placeholder "Low",
  // MQL5 page scrapes "High". The fresh value must win.
  assertEquals(resolveImpact("Low", "High"), "High");
});

Deno.test("resolveImpact: fills an empty cached impact", () => {
  assertEquals(resolveImpact(null, "Medium"), "Medium");
  assertEquals(resolveImpact("", "High"), "High");
});

Deno.test("resolveImpact: never silently downgrades a genuine higher rating", () => {
  // Respects the original "don't clobber the primary source" intent.
  assertEquals(resolveImpact("High", "Low"), null);
  assertEquals(resolveImpact("High", "Medium"), null);
  assertEquals(resolveImpact("Medium", "Low"), null);
});

Deno.test("resolveImpact: equal rank rewrites (idempotent refresh)", () => {
  assertEquals(resolveImpact("High", "High"), "High");
});

Deno.test("resolveImpact: ignores an unrecognized scraped value", () => {
  assertEquals(resolveImpact("Low", "n/d"), null);
  assertEquals(resolveImpact("Low", null), null);
});
