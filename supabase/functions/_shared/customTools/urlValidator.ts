// SSRF protection for custom-tool webhook URLs.
//
// validateWebhookUrlSync runs on every call (cheap — string + literal-IP).
// validateWebhookUrl additionally resolves the hostname via DNS; use it at
// registration (and at dispatch time if you want rebinding protection).
//
// Blocks: non-https schemes, literal private/loopback/link-local/metadata
// IPs (v4 and v6, including non-decimal v4 encodings and v4-mapped /
// 6to4 / NAT64 v6 forms), known metadata hostnames, *.local mDNS names.

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  resolvedIps?: string[];
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
]);

/**
 * Range-check a 32-bit IPv4 int against private/reserved space. Pulled out
 * so non-decimal IPv4 forms (integer, 0x..., 0...) and IPv4-mapped IPv6
 * forms can reuse the blocklist without re-stringifying.
 */
function isBlockedIpv4Int(n: number): boolean {
  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff],  // 0.0.0.0/8
    [0x0a000000, 0x0affffff],  // 10.0.0.0/8
    [0x64400000, 0x647fffff],  // 100.64.0.0/10 CGN
    [0x7f000000, 0x7fffffff],  // 127.0.0.0/8 loopback
    [0xa9fe0000, 0xa9feffff],  // 169.254.0.0/16 link-local
    [0xac100000, 0xac1fffff],  // 172.16.0.0/12 rfc1918
    [0xc0a80000, 0xc0a8ffff],  // 192.168.0.0/16 rfc1918
    [0xe0000000, 0xefffffff],  // 224.0.0.0/4 multicast
    [0xf0000000, 0xffffffff],  // 240.0.0.0/4 reserved
  ];
  for (const [lo, hi] of ranges) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

/**
 * Parse any IETF inet_aton-style IPv4 encoding: dotted decimal, dotted
 * hex (`0x7f.0.0.1`), dotted octal (`0177.0.0.1`), single integer
 * (`2130706433`), or single hex (`0x7f000001`). Returns the 32-bit value
 * or null on parse failure.
 *
 * WHATWG `new URL()` normalizes most of these to dotted-decimal, but
 * runtime-dependent — Deno's URL impl has differed from browsers in the
 * past. We treat the parser as untrusted and re-check defensively.
 */
function tryParseIpv4General(input: string): number | null {
  if (input.length === 0 || input.length > 64) return null;

  // Single-component (integer or hex) form. No dots.
  if (!input.includes(".")) {
    if (/^\d+$/.test(input)) {
      const n = Number(input);
      if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
      return null;
    }
    if (/^0x[0-9a-f]+$/i.test(input)) {
      const n = parseInt(input.slice(2), 16);
      if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
    }
    return null;
  }

  const parts = input.split(".");
  if (parts.length < 2 || parts.length > 4) return null;

  const values: number[] = [];
  for (const p of parts) {
    if (p === "") return null;
    let v: number;
    if (/^0x[0-9a-f]+$/i.test(p)) {
      v = parseInt(p.slice(2), 16);
    } else if (/^0[0-7]+$/.test(p)) {
      v = parseInt(p, 8);
    } else if (/^\d+$/.test(p)) {
      v = Number(p);
    } else {
      return null;
    }
    if (!Number.isFinite(v) || v < 0) return null;
    values.push(v);
  }

  // Per inet_aton, the last component absorbs the remaining bytes.
  if (values.length === 4) {
    if (values.some((v) => v > 255)) return null;
    return ((values[0] << 24) | (values[1] << 16) | (values[2] << 8) | values[3]) >>> 0;
  }
  if (values.length === 3) {
    if (values[0] > 255 || values[1] > 255 || values[2] > 0xffff) return null;
    return ((values[0] << 24) | (values[1] << 16) | values[2]) >>> 0;
  }
  if (values.length === 2) {
    if (values[0] > 255 || values[1] > 0xffffff) return null;
    return ((values[0] << 24) | values[1]) >>> 0;
  }
  return null;
}

function isIpv6(host: string): boolean {
  return host.includes(":");
}

/**
 * Expand an IPv6 string to its canonical 8-group form. Each group is the
 * hex of its 16-bit value with leading zeros stripped. Returns null on
 * parse failure. Catches the leading-zero / shorthand bypass variants.
 */
function expandIpv6(addr: string): string | null {
  if (addr.split("::").length > 2) return null;
  const [head, tail = ""] = addr.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if (addr.includes("::")) {
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const all = [...headParts, ...new Array(missing).fill("0"), ...tailParts];
    if (all.length !== 8) return null;
    return all.map((p) => parseInt(p, 16).toString(16)).join(":");
  }
  if (headParts.length !== 8) return null;
  return headParts.map((p) => parseInt(p, 16).toString(16)).join(":");
}

function isBlockedIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();

  // v4-mapped with dotted-decimal tail: ::ffff:1.2.3.4 (modern) and
  // ::1.2.3.4 (deprecated IPv4-compatible). expandIpv6 can't parse these,
  // so do it inline.
  if (h.includes(".")) {
    const mapped = h.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      const n = tryParseIpv4General(mapped[1]);
      return n !== null && isBlockedIpv4Int(n);
    }
  }

  const canonical = expandIpv6(h);
  if (canonical === null) return false;

  const groups = canonical.split(":").map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isFinite(g) || g < 0 || g > 0xffff)) {
    return false;
  }
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  // :: unspecified, ::1 loopback.
  if (groups.every((g) => g === 0)) return true;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return true;
  }

  // fe80::/10 link-local — first 10 bits are 1111111010 → g0 in [0xfe80, 0xfebf].
  if (g0 >= 0xfe80 && g0 <= 0xfebf) return true;

  // fc00::/7 unique-local — first 7 bits are 1111110 → g0 mask 0xfe00 == 0xfc00.
  if ((g0 & 0xfe00) === 0xfc00) return true;

  // ff00::/8 multicast.
  if ((g0 & 0xff00) === 0xff00) return true;

  // 64:ff9b::/96 NAT64 well-known prefix — first 6 groups encode 0064:ff9b:0:0:0:0,
  // last two are the embedded v4.
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4Int(((g6 << 16) | g7) >>> 0);
  }

  // 2002::/16 6to4 — g1.g2 is the encoded public v4; reject if that v4 is private.
  if (g0 === 0x2002) {
    return isBlockedIpv4Int(((g1 << 16) | g2) >>> 0);
  }

  // ::ffff:0:0/96 v4-mapped (hex form) — first 5 groups zero, g5 == 0xffff,
  // g6:g7 is the embedded v4.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIpv4Int(((g6 << 16) | g7) >>> 0);
  }

  return false;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;     // mDNS
  if (h.endsWith(".internal")) return true;  // common internal TLD
  return false;
}

export function validateWebhookUrlSync(input: string): UrlValidationResult {
  if (typeof input !== "string" || input.length === 0) {
    return { valid: false, reason: "url is empty" };
  }
  if (input.length > 2048) {
    return { valid: false, reason: "url exceeds 2048 chars" };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { valid: false, reason: "url failed to parse" };
  }

  if (url.protocol !== "https:") {
    return { valid: false, reason: "only https:// is allowed" };
  }
  if (url.username || url.password) {
    return { valid: false, reason: "userinfo in url is not allowed" };
  }

  const host = url.hostname;
  if (!host) {
    return { valid: false, reason: "url has no host" };
  }

  if (isBlockedHostname(host)) {
    return { valid: false, reason: `hostname '${host}' is blocked` };
  }

  if (isIpv6(host)) {
    if (isBlockedIpv6(host)) {
      return { valid: false, reason: `ipv6 ${host} is in a blocked range` };
    }
    return { valid: true };
  }

  // IPv4 — try the inet_aton general parser to catch integer/hex/octal
  // forms that bypass a naïve dotted-decimal regex. If parser succeeds,
  // the host is a literal IP and we range-check it. If it returns null,
  // fall through to treating it as a DNS name.
  const ipv4Int = tryParseIpv4General(host);
  if (ipv4Int !== null) {
    if (isBlockedIpv4Int(ipv4Int)) {
      return { valid: false, reason: `ipv4 ${host} is in a blocked range` };
    }
  }

  return { valid: true };
}

/**
 * Async-friendly validator. Currently delegates to the sync path because
 * Supabase Edge Functions (Deno Deploy runtime) don't reliably support
 * `Deno.resolveDns` — calls hang until the platform kills the worker
 * (~10s → 502 Bad Gateway). We accept the DNS-rebinding gap for v1; the
 * runtime data-fence wrapper around tool responses is the primary
 * injection defense, and literal-IP + hostname blocklists cover the
 * common SSRF surface.
 *
 * The signature stays async so callers can adopt real DNS resolution
 * later (e.g. via a DNS-over-HTTPS lookup against 1.1.1.1) without
 * another refactor.
 */
export async function validateWebhookUrl(input: string): Promise<UrlValidationResult> {
  return validateWebhookUrlSync(input);
}
