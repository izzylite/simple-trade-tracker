// Run with: deno test --allow-net supabase/functions/_shared/customTools/urlValidator.test.ts

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateWebhookUrlSync } from "./urlValidator.ts";

Deno.test("accepts a normal https url", () => {
  const r = validateWebhookUrlSync("https://example.com/webhook");
  assertEquals(r.valid, true);
});

Deno.test("rejects http://", () => {
  const r = validateWebhookUrlSync("http://example.com/webhook");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("https"));
});

Deno.test("rejects other schemes", () => {
  for (const u of [
    "ftp://example.com/x",
    "file:///etc/passwd",
    "gopher://example.com",
    "data:text/plain,hi",
  ]) {
    const r = validateWebhookUrlSync(u);
    assertEquals(r.valid, false, `${u} should be invalid`);
  }
});

Deno.test("rejects empty / oversized", () => {
  assertEquals(validateWebhookUrlSync("").valid, false);
  assertEquals(validateWebhookUrlSync("https://" + "a".repeat(2100)).valid, false);
});

Deno.test("rejects unparseable", () => {
  assertEquals(validateWebhookUrlSync("not a url").valid, false);
  assertEquals(validateWebhookUrlSync("https://").valid, false);
});

Deno.test("rejects userinfo in url", () => {
  const r = validateWebhookUrlSync("https://user:pass@example.com/");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("userinfo"));
});

Deno.test("rejects literal blocked hostnames", () => {
  for (const h of [
    "https://localhost/",
    "https://localhost:8080/",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://app.localhost/",
    "https://service.local/",
    "https://kube.internal/",
  ]) {
    const r = validateWebhookUrlSync(h);
    assertEquals(r.valid, false, `${h} should be blocked`);
  }
});

Deno.test("rejects loopback ipv4", () => {
  for (const u of [
    "https://127.0.0.1/",
    "https://127.5.5.5/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, false);
  }
});

Deno.test("rejects rfc1918 ipv4", () => {
  for (const u of [
    "https://10.0.0.1/",
    "https://10.255.255.255/",
    "https://172.16.0.1/",
    "https://172.31.255.255/",
    "https://192.168.1.1/",
    "https://192.168.255.255/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, false, `${u} should be blocked`);
  }
});

Deno.test("rejects link-local + metadata ipv4", () => {
  for (const u of [
    "https://169.254.169.254/latest/meta-data/",
    "https://169.254.1.1/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, false);
  }
});

Deno.test("rejects 0.0.0.0/8 and CGN and multicast", () => {
  for (const u of [
    "https://0.0.0.0/",
    "https://100.64.1.1/",
    "https://224.0.0.1/",
    "https://240.0.0.1/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, false, `${u} should be blocked`);
  }
});

Deno.test("rejects ipv6 loopback and unique-local", () => {
  for (const u of [
    "https://[::1]/",
    "https://[fc00::1]/",
    "https://[fd12:3456:789a::1]/",
    "https://[fe80::1]/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, false, `${u} should be blocked`);
  }
});

Deno.test("rejects ipv4-mapped ipv6 to private space", () => {
  // ::ffff:10.0.0.1 — IPv4-mapped to 10.0.0.1, must be blocked.
  const r = validateWebhookUrlSync("https://[::ffff:10.0.0.1]/");
  assertEquals(r.valid, false);
});

Deno.test("accepts public ipv4", () => {
  for (const u of [
    "https://8.8.8.8/",
    "https://1.1.1.1/",
    "https://203.0.113.5/",
  ]) {
    assertEquals(validateWebhookUrlSync(u).valid, true, `${u} should be allowed`);
  }
});

Deno.test("rejects unparseable IP-looking host (WHATWG throws on >255 octet)", () => {
  // WHATWG URL rejects "999.1.1.1" at parse time. Confirm we surface that
  // as a parse failure (not a misleading "ipv4 ... is in a blocked range").
  const r = validateWebhookUrlSync("https://999.1.1.1/");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("parse"));
});

Deno.test("rejects non-decimal ipv4 encodings that hit private space", () => {
  // WHATWG normalizes most of these to dotted decimal, but Deno's
  // behavior has varied. Re-check via inet_aton general parser regardless.
  for (const u of [
    "https://2130706433/",        // single-integer 127.0.0.1
    "https://0x7f000001/",        // single-hex 127.0.0.1
    "https://0x7f.0.0.1/",        // dotted-hex
    "https://0177.0.0.1/",        // dotted-octal 127.0.0.1
    "https://127.1/",             // 2-component shorthand 127.0.0.1
    "https://3232235521/",        // single-integer 192.168.0.1
  ]) {
    const r = validateWebhookUrlSync(u);
    assertEquals(r.valid, false, `${u} should be blocked`);
  }
});

Deno.test("rejects ipv6 link-local with full-form expansion", () => {
  // fe80:0000:0000:0000:0000:0000:0000:0001 should still trip the
  // link-local check after canonical expansion.
  const r = validateWebhookUrlSync("https://[fe80:0:0:0:0:0:0:1]/");
  assertEquals(r.valid, false);
});

Deno.test("rejects ipv6 NAT64 wrapping private v4", () => {
  // 64:ff9b::10.0.0.1 — NAT64 well-known prefix encoding 10.0.0.1.
  const r = validateWebhookUrlSync("https://[64:ff9b::a00:1]/");
  assertEquals(r.valid, false);
});

Deno.test("rejects ipv6 6to4 wrapping private v4", () => {
  // 2002:: prefix with private v4 in g1:g2 — 2002:c0a8:0101:: → 192.168.1.1.
  const r = validateWebhookUrlSync("https://[2002:c0a8:101::]/");
  assertEquals(r.valid, false);
});

Deno.test("rejects ipv6 v4-mapped hex form to private space", () => {
  // ::ffff:c0a8:0101 — v4-mapped hex form of 192.168.1.1.
  const r = validateWebhookUrlSync("https://[::ffff:c0a8:101]/");
  assertEquals(r.valid, false);
});

Deno.test("accepts ipv6 6to4 to public v4", () => {
  // 2002:0808:0808:: encodes 8.8.8.8 — public, allow.
  const r = validateWebhookUrlSync("https://[2002:808:808::]/");
  assertEquals(r.valid, true);
});
