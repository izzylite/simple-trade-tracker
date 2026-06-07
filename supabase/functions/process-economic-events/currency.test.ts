import { assertEquals } from "jsr:@std/assert@1";
import { CALENDAR_CURRENCIES, CURRENCY_REGEX } from "./currency.ts";

Deno.test("CALENDAR_CURRENCIES includes the 9 covered currencies", () => {
  for (const c of ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"]) {
    assertEquals(CALENDAR_CURRENCIES.includes(c), true, `${c} should be covered`);
  }
});

Deno.test("CURRENCY_REGEX matches every covered currency (incl. NZD/CNY)", () => {
  for (const c of CALENDAR_CURRENCIES) {
    assertEquals(CURRENCY_REGEX.test(`Some Event ${c} 12:30`), true, `${c} should match`);
    // .match returns the captured currency (used to extract it from a cell)
    assertEquals(`x ${c} y`.match(CURRENCY_REGEX)?.[1], c);
  }
});

Deno.test("CURRENCY_REGEX does not match non-covered currencies or noise", () => {
  for (const c of ["BRL", "ZAR", "MXN", "SEK", "USDX", "Nonfarm"]) {
    assertEquals(CURRENCY_REGEX.test(`Event ${c} value`), false, `${c} must not match`);
  }
});

Deno.test("CURRENCY_REGEX is non-global (safe to reuse across test/match calls)", () => {
  // A global regex would carry lastIndex between calls and skip matches.
  assertEquals(CURRENCY_REGEX.global, false);
});
