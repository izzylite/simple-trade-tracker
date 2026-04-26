// Run with: deno test --allow-env --no-check supabase/functions/_shared/memory/episodic.test.ts
//
// Two tiers of coverage:
//
//   1. Pure validators — validateRecordEventInput, normalizeRecallFilter.
//      Cover the cheap "agent sent garbage" rejection paths exhaustively.
//
//   2. Fake-store integration — exercises recordEvent / recallEvents
//      against a tiny in-memory mock that mimics just enough of the
//      supabase-js builder API to drive the code paths. Lets us verify
//      the daily-cap, filter combination, ordering, and error handling
//      without standing up a real Postgres.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  normalizeRecallFilter,
  recallEvents,
  recordEvent,
  validateRecordEventInput,
} from "./episodic.ts";
import {
  EPISODIC_DAILY_WRITE_CAP,
  EPISODIC_RECALL_DEFAULT_LIMIT,
  EPISODIC_RECALL_MAX_LIMIT,
  EPISODIC_SUMMARY_MAX_LENGTH,
  type EpisodicEventType,
} from "./types.ts";

// ===========================================================================
// validateRecordEventInput
// ===========================================================================

Deno.test("validate: accepts canonical input", () => {
  const r = validateRecordEventInput({
    event_type: "user_correction",
    summary: "User corrected daily stop from $200 to $150",
    tags: ["risk", "stop"],
    metadata: { confidence: "high" },
  });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.value.event_type, "user_correction");
    assertEquals(r.value.tags, ["risk", "stop"]);
  }
});

Deno.test("validate: rejects unknown event_type", () => {
  const r = validateRecordEventInput({
    event_type: "made_up" as EpisodicEventType,
    summary: "x",
  });
  assert(!r.ok);
  if (!r.ok) assertStringIncludes(r.error, "Invalid event_type");
});

Deno.test("validate: rejects empty summary", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "   ",
  });
  assert(!r.ok);
  if (!r.ok) assertStringIncludes(r.error, "summary");
});

Deno.test("validate: rejects oversize summary", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "x".repeat(EPISODIC_SUMMARY_MAX_LENGTH + 1),
  });
  assert(!r.ok);
  if (!r.ok) assertStringIncludes(r.error, "exceeds");
});

Deno.test("validate: trims summary and drops empty tags", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "  changed stop  ",
    tags: ["risk", "", "  ", "stop"],
  });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.value.summary, "changed stop");
    assertEquals(r.value.tags, ["risk", "stop"]);
  }
});

Deno.test("validate: rejects non-string entries in tags", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "x",
    tags: ["ok", 5 as unknown as string, "ok2"],
  });
  assert(!r.ok);
});

Deno.test("validate: rejects non-object metadata (array)", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "x",
    metadata: ["a", "b"] as unknown as Record<string, unknown>,
  });
  assert(!r.ok);
});

Deno.test("validate: rejects null metadata", () => {
  const r = validateRecordEventInput({
    event_type: "rule_changed",
    summary: "x",
    metadata: null as unknown as Record<string, unknown>,
  });
  assert(!r.ok);
});

// ===========================================================================
// normalizeRecallFilter
// ===========================================================================

Deno.test("normalize: empty filter yields all undefineds + default limit", () => {
  const f = normalizeRecallFilter(undefined);
  assertEquals(f.event_types, undefined);
  assertEquals(f.tags, undefined);
  assertEquals(f.since, undefined);
  assertEquals(f.query, undefined);
  assertEquals(f.limit, EPISODIC_RECALL_DEFAULT_LIMIT);
});

Deno.test("normalize: clamps oversized limit to max", () => {
  const f = normalizeRecallFilter({ limit: 9999 });
  assertEquals(f.limit, EPISODIC_RECALL_MAX_LIMIT);
});

Deno.test("normalize: zero/negative limit falls back to default", () => {
  assertEquals(
    normalizeRecallFilter({ limit: 0 }).limit,
    EPISODIC_RECALL_DEFAULT_LIMIT,
  );
  assertEquals(
    normalizeRecallFilter({ limit: -5 }).limit,
    EPISODIC_RECALL_DEFAULT_LIMIT,
  );
});

Deno.test("normalize: drops unknown event_types silently", () => {
  const f = normalizeRecallFilter({
    event_types: [
      "rule_changed",
      "bogus" as EpisodicEventType,
      "user_correction",
    ],
  });
  assertEquals(f.event_types, ["rule_changed", "user_correction"]);
});

Deno.test("normalize: trims tags and drops empties", () => {
  const f = normalizeRecallFilter({ tags: [" risk ", "", "stop"] });
  assertEquals(f.tags, ["risk", "stop"]);
});

Deno.test("normalize: empty arrays/strings reduce to undefined", () => {
  const f = normalizeRecallFilter({
    event_types: [],
    tags: [],
    since: "  ",
    query: "",
  });
  assertEquals(f.event_types, undefined);
  assertEquals(f.tags, undefined);
  assertEquals(f.since, undefined);
  assertEquals(f.query, undefined);
});

// ===========================================================================
// Fake supabase-js client — just enough builder surface for episodic.ts
// ===========================================================================

type Row = {
  id: string;
  user_id: string;
  calendar_id: string;
  occurred_at: string;
  event_type: EpisodicEventType;
  summary: string;
  tags: string[];
  metadata: Record<string, unknown>;
};

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private orderBy: { col: keyof Row; asc: boolean } | null = null;
  private limitCount: number | null = null;
  private headOnly = false;
  private wantsCount = false;

  constructor(private rows: Row[], private inserts: Row[] | null = null) {}

  // SELECT path
  eq(col: keyof Row, value: unknown): this {
    this.filters.push((r) => (r[col] as unknown) === value);
    return this;
  }
  in(col: keyof Row, vals: unknown[]): this {
    this.filters.push((r) => vals.includes(r[col] as unknown));
    return this;
  }
  gte(col: keyof Row, value: unknown): this {
    this.filters.push((r) =>
      (r[col] as unknown as string) >= (value as string)
    );
    return this;
  }
  contains(col: keyof Row, vals: unknown[]): this {
    this.filters.push((r) => {
      const arr = r[col] as unknown as string[];
      return (vals as string[]).every((v) => arr.includes(v));
    });
    return this;
  }
  ilike(col: keyof Row, pattern: string): this {
    // Treat % as a wildcard for substring; we only ever pass "%foo%".
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((r) =>
      (r[col] as unknown as string).toLowerCase().includes(needle)
    );
    return this;
  }
  order(col: keyof Row, opts: { ascending: boolean }): this {
    this.orderBy = { col, asc: opts.ascending };
    return this;
  }
  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  // Awaiting the builder runs the query
  then<T>(resolve: (v: T) => unknown): Promise<unknown> {
    return Promise.resolve(this.run()).then(resolve as (v: unknown) => unknown);
  }

  private run(): { data: Row[] | null; error: null; count?: number } {
    let result = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      result = [...result].sort((a, b) => {
        const av = a[col] as unknown as string;
        const bv = b[col] as unknown as string;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    if (this.wantsCount) {
      return {
        data: this.headOnly ? null : result,
        error: null,
        count: result.length,
      };
    }
    return { data: result, error: null };
  }

  // SELECT with options. Mock supports {count: 'exact', head: true} which
  // recordEvent uses for the daily-count check.
  select(_cols: string, opts?: { count?: string; head?: boolean }): this {
    this.wantsCount = !!opts?.count;
    this.headOnly = !!opts?.head;
    return this;
  }

  // INSERT path — must be terminal: returns { error: null } directly.
  insert(row: Omit<Row, "id" | "occurred_at"> & {
    occurred_at?: string;
  }): Promise<{ error: null }> {
    if (!this.inserts) throw new Error("insert called on a non-insert builder");
    this.inserts.push({
      id: `id-${this.inserts.length + 1}`,
      occurred_at: row.occurred_at ?? new Date().toISOString(),
      ...row,
    } as Row);
    return Promise.resolve({ error: null });
  }
}

class FakeClient {
  rows: Row[] = [];
  from(_table: string): FakeBuilder {
    return new FakeBuilder(this.rows, this.rows);
  }
}

// Type assertion helper — episodic.ts expects a SupabaseClient but our fake
// only implements the methods it actually uses. Cast is safe within tests.
// deno-lint-ignore no-explicit-any
const asClient = (c: FakeClient) => c as any;

// ===========================================================================
// recordEvent
// ===========================================================================

Deno.test("recordEvent: rejects bad input before touching DB", async () => {
  const client = new FakeClient();
  const r = await recordEvent(asClient(client), "u1", "c1", {
    event_type: "rule_changed",
    summary: "",
  });
  assertStringIncludes(r, "rejected");
  assertEquals(client.rows.length, 0);
});

Deno.test("recordEvent: writes valid event and reports event_type", async () => {
  const client = new FakeClient();
  const r = await recordEvent(asClient(client), "u1", "c1", {
    event_type: "rule_changed",
    summary: "Daily stop changed from $200 to $150",
  });
  assertStringIncludes(r, "rule_changed");
  assertEquals(client.rows.length, 1);
  assertEquals(client.rows[0].event_type, "rule_changed");
});

Deno.test("recordEvent: rejects on daily cap, leaves prior rows intact", async () => {
  const client = new FakeClient();
  // Pre-fill at the cap with today's rows for (u1, c1).
  const todayIso = new Date().toISOString();
  for (let i = 0; i < EPISODIC_DAILY_WRITE_CAP; i++) {
    client.rows.push({
      id: `seed-${i}`,
      user_id: "u1",
      calendar_id: "c1",
      occurred_at: todayIso,
      event_type: "pattern_observed",
      summary: `seed ${i}`,
      tags: [],
      metadata: {},
    });
  }

  const r = await recordEvent(asClient(client), "u1", "c1", {
    event_type: "rule_changed",
    summary: "should be rejected",
  });
  assertStringIncludes(r, "log is full");
  assertEquals(client.rows.length, EPISODIC_DAILY_WRITE_CAP); // no new write
});

Deno.test("recordEvent: cap is per (user, calendar) — other calendars unaffected", async () => {
  const client = new FakeClient();
  const todayIso = new Date().toISOString();
  // Fill u1/c1 to cap.
  for (let i = 0; i < EPISODIC_DAILY_WRITE_CAP; i++) {
    client.rows.push({
      id: `seed-${i}`,
      user_id: "u1",
      calendar_id: "c1",
      occurred_at: todayIso,
      event_type: "pattern_observed",
      summary: `seed ${i}`,
      tags: [],
      metadata: {},
    });
  }
  // u1/c2 is empty — should accept.
  const r = await recordEvent(asClient(client), "u1", "c2", {
    event_type: "rule_changed",
    summary: "different calendar, fresh quota",
  });
  assertStringIncludes(r, "rule_changed");
  assertEquals(client.rows.length, EPISODIC_DAILY_WRITE_CAP + 1);
});

// ===========================================================================
// recallEvents
// ===========================================================================

const seed = (
  client: FakeClient,
  partial: Partial<Row> & { id: string; occurred_at: string },
): void => {
  client.rows.push({
    user_id: "u1",
    calendar_id: "c1",
    event_type: "pattern_observed",
    summary: "default",
    tags: [],
    metadata: {},
    ...partial,
  } as Row);
};

Deno.test("recallEvents: rejects unfiltered call", async () => {
  const client = new FakeClient();
  const r = await recallEvents(asClient(client), "u1", "c1", undefined);
  assertStringIncludes(r.message, "requires at least one filter");
  assertEquals(r.events.length, 0);
});

Deno.test("recallEvents: filters by event_type, returns most-recent first", async () => {
  const client = new FakeClient();
  seed(client, {
    id: "1",
    occurred_at: "2026-04-20T00:00:00Z",
    event_type: "rule_changed",
    summary: "older rule change",
  });
  seed(client, {
    id: "2",
    occurred_at: "2026-04-25T00:00:00Z",
    event_type: "rule_changed",
    summary: "newer rule change",
  });
  seed(client, {
    id: "3",
    occurred_at: "2026-04-26T00:00:00Z",
    event_type: "user_correction",
    summary: "a correction",
  });

  const r = await recallEvents(asClient(client), "u1", "c1", {
    event_types: ["rule_changed"],
  });
  assertEquals(r.events.length, 2);
  assertEquals(r.events[0].id, "2"); // most recent first
  assertEquals(r.events[1].id, "1");
});

Deno.test("recallEvents: filters by tag intersection", async () => {
  const client = new FakeClient();
  seed(client, {
    id: "1",
    occurred_at: "2026-04-25T00:00:00Z",
    tags: ["risk"],
    summary: "risk only",
  });
  seed(client, {
    id: "2",
    occurred_at: "2026-04-26T00:00:00Z",
    tags: ["risk", "stop"],
    summary: "risk and stop",
  });
  seed(client, {
    id: "3",
    occurred_at: "2026-04-25T00:00:00Z",
    tags: ["session"],
    summary: "session only",
  });

  const r = await recallEvents(asClient(client), "u1", "c1", {
    tags: ["risk", "stop"],
  });
  assertEquals(r.events.length, 1);
  assertEquals(r.events[0].id, "2");
});

Deno.test("recallEvents: query is case-insensitive substring match", async () => {
  const client = new FakeClient();
  seed(client, {
    id: "1",
    occurred_at: "2026-04-25T00:00:00Z",
    summary: "Discussed FOMC volatility patterns",
  });
  seed(client, {
    id: "2",
    occurred_at: "2026-04-26T00:00:00Z",
    summary: "Reviewed risk management",
  });

  const r = await recallEvents(asClient(client), "u1", "c1", { query: "fomc" });
  assertEquals(r.events.length, 1);
  assertEquals(r.events[0].id, "1");
});

Deno.test("recallEvents: respects limit clamping (50 max)", async () => {
  const client = new FakeClient();
  for (let i = 0; i < 60; i++) {
    seed(client, {
      id: `${i}`,
      occurred_at: `2026-04-${String(i % 30 + 1).padStart(2, "0")}T00:00:00Z`,
      summary: `event ${i}`,
    });
  }
  const r = await recallEvents(asClient(client), "u1", "c1", {
    query: "event",
    limit: 9999,
  });
  assertEquals(r.events.length, EPISODIC_RECALL_MAX_LIMIT);
});

Deno.test("recallEvents: scopes to (user, calendar) — other rows invisible even when content matches", async () => {
  // All three rows share the same summary text. If user_id/calendar_id
  // scoping were broken, the query would return all 3. Strict version of
  // the scoping check — earlier iteration silently passed because the
  // other rows happened not to match the query.
  const client = new FakeClient();
  seed(client, {
    id: "1",
    occurred_at: "2026-04-26T00:00:00Z",
    user_id: "u1",
    calendar_id: "c1",
    summary: "discussed FOMC volatility",
  });
  seed(client, {
    id: "2",
    occurred_at: "2026-04-26T00:00:00Z",
    user_id: "u2",
    calendar_id: "c1", // same calendar, different user
    summary: "discussed FOMC volatility",
  });
  seed(client, {
    id: "3",
    occurred_at: "2026-04-26T00:00:00Z",
    user_id: "u1",
    calendar_id: "c2", // same user, different calendar
    summary: "discussed FOMC volatility",
  });

  const r = await recallEvents(asClient(client), "u1", "c1", {
    query: "FOMC",
  });
  assertEquals(r.events.length, 1, "scoping must isolate (user, calendar)");
  assertEquals(r.events[0].id, "1");
});

Deno.test("recallEvents: empty query becomes undefined, fails the no-filter guard", async () => {
  const client = new FakeClient();
  seed(client, {
    id: "1",
    occurred_at: "2026-04-26T00:00:00Z",
    summary: "anything",
  });
  const r = await recallEvents(asClient(client), "u1", "c1", { query: "" });
  assertEquals(r.events.length, 0);
  assertStringIncludes(r.message, "requires at least one filter");
});
