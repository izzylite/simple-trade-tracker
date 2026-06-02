# Orion (`ai-trading-agent`) — AI-Infra Audit vs Official Google Gemini + Supabase Docs

**Date:** 2026-06-01 · **Deployed model:** `gemini-3-flash-preview` (operator-confirmed)
**Method:** 56-agent workflow — 4 doc-grounding agents → 10 audit dimensions → adversarial per-finding verification → completeness critic.
**Result:** 28 confirmed (1 CRITICAL · 7 HIGH · 8 MEDIUM · 12 LOW), 13 refuted as false positives, 13 uncovered-surface gaps, 55 verified-clean.

**Verdict:** The **primary interactive streaming chat path is solid and doc-compliant.** The real defects cluster on the *non-streaming / continuation / reminder* paths and the *shared `_shared/gemini.ts` helper* — several are silent-data-loss or 400-shaped and scale-relevant. Not ship-blocking for the streaming happy path; the CRITICAL + the HIGH cluster should be fixed before relying on reminders/non-streaming at scale.

---

## CRITICAL

### loop-1 — Parallel function calls silently dropped on continuation / non-streaming / reminder turns
`index.ts:558-562, 481, 915-918`
Only **turn-1 of the streaming loop** collects all `functionCall` parts (`callGeminiStreaming` L1156-1165). Every **continuation** goes through `callGeminiWithContents`/`callGemini`, which keep **one** call (`parts.find(p => p.functionCall)` / `functionCalls[0]`). When Gemini emits N parallel calls after turn 1, the loop executes only the first, returns one `functionResponse`, but echoes `rawParts` containing **all N** functionCall parts → **malformed turn (call/response count mismatch) → Gemini 400 + silent loss of the other tool results.** The reminder + non-streaming loops have **no parallel branch at all** (loop-5), so they hit this on turn 1.
**Fix:** make every continuation path return `functionCalls[]` (plural) and add a parallel-execution branch (mirroring streaming L1433-1507) to the reminder + non-streaming loops — execute all, one `functionResponse` per `call.id`, echo `rawParts` once.

---

## HIGH

### genconfig-2 — Non-streaming AUTO continuations run at temperature 0.3
`index.ts:475-477` → inherits `_shared/gemini.ts:126` `?? 0.3`. Hits the reminder loop (L2332), non-streaming chat continuations (L2984), and the ID-correction retry (L3098). Gemini-3 docs explicitly warn temp <1.0 on tool-using paths → looping/degraded reasoning. **Fix:** pass `temperature: 1.0` for tool-using (mode≠NONE) calls; keep 0.3 only for `responseSchema`/`NONE` synthesis.

### genconfig-3 — Initial chat call capped at 4000 tokens with thinking on
`index.ts:1019` `buildGenerationConfig(4000, thinkingLevel)`. Thought tokens are deducted from the same budget; a high-thinking first turn can hit `MAX_TOKENS` with empty visible text. Continuations already use 8000; turn-1 (the heaviest) doesn't. The empty-bug retries re-call at the same 4000. **Fix:** raise initial to 8000; on retry escalate cap and/or step thinking down.

### emptyresp-1 — The force-synthesis fallback (the never-empty mechanism) can itself return empty
`_shared/gemini.ts:180-191` never inspects `finishReason`. Synthesis calls use `maxOutputTokens:4000` + `thinkingLevel:'medium'` (no `thinkingBudget:0`), so on a large tool-result history thinking can eat the whole budget → empty synthesis (silently a no-op, saved only by the canned last-resort string). **Fix:** disable thinking on the synthesis turn (`thinkingBudget:0`, not alongside `thinkingLevel`) + raise to 8192; surface `finishReason` so empty-with-MAX_TOKENS is detectable and retried.

### persist-1 — Messages array read-modify-write has no atomic guard → lost-update race
`conversationStore.ts:170-256` (+ `appendAssistantMessage` 331-370, inline reminder append `index.ts:2409-2437`). The `.lt('last_prompt_tokens', …)` guard caps the *token budget*, not the *array*. Two concurrent turns (two tabs, or a reminder firing during an active chat) both SELECT the same `messages`, both `[...existing, msg]`, both UPDATE — the second clobbers the first. On a fresh row `last_prompt_tokens=0` so both racers pass. Scale-relevant per CLAUDE.md. **Fix:** atomic Postgres append via SECURITY DEFINER RPC (`messages = messages || p_msg` under the row lock), mirroring the `project_bulk_write_skip_webhook_pattern` precedent; or optimistic `.eq('message_count', readCount)` + retry-on-zero-rows.

### thoughtsig-1 / thoughtsig-2 — Parallel-call collapse on continuations breaks the rawParts↔functionResponse balance
`index.ts:514-562, 573` and the reassignment sites `1618-1620, 2995-2997, 2343-2345`. Same root as loop-1: `callGeminiWithContents` tracks a single `functionCall`, never the plural array, so a parallel continuation turn echoes N functionCall parts (signature intact) but only 1 functionResponse → Gemini-3 400. **Fix:** part of the loop-1 fix — accumulate + propagate `functionCalls[]`.

### wallclock-1 — Non-streaming persist registered downstream of unbounded post-break Gemini calls
`index.ts:3004-3119, 3210-3250`. After the 130s break: force-synthesis → up to 2 more 8000-token validation calls → embed fetch, and *only then* `EdgeRuntime.waitUntil(persist)` (L3245). The non-streaming handler returns its Response at the very end, so the binding ceiling is the **150s request idle timeout** (every plan). If it fires before L3245, the persist is never registered → assistant message silently lost. **Fix:** re-check wall-clock before synthesis and each validation call (skip + regex-strip on overrun); register the persist with the latest text *before* the validation loop.

---

## MEDIUM
- **emptyresp-3** `index.ts:1744-1751` (+3109-3116) — ID-validation correction can overwrite a good answer with an empty string → blank persisted message. Guard adoption: only adopt non-empty corrected text.
- **emptyresp-4** `index.ts:1636-1644` (+2352, 3007, orionAgent 201) — force-synthesis call has no wall-clock check/AbortSignal; a slow synthesis after a ~129s break can blow past the 150s kill. Thread `AbortSignal.timeout(remaining)`; skip synthesis if no budget left.
- **errors-2** `formatters.ts:114` — non-streaming `formatErrorResponse` returns the **raw provider body** (`error: error.message`) to the browser alongside the friendly message. Drop the raw field (already logged server-side).
- **errors-3** `index.ts:1476` — built-in tool errors (incl. raw SQL/MCP detail) streamed verbatim to the client via `tool_result` SSE + `done` metadata; `scrubWebhookResults` only nulls webhook results. Send a generic label to the client; keep detail only in the model-facing functionResponse.
- **genconfig-1 / loop-2** `_shared/gemini.ts:126` — the shared `?? 0.3` default bleeds onto tool-using AUTO paths (market-research round1 is live; orionAgent is currently dead code). Default to 1.0 for tool-present non-NONE calls.
- **genconfig-4** `index.ts:1132,1146,1213` — streaming empty-detector treats only `STOP`+empty as the bug; `MAX_TOKENS`+empty (thinking starvation) is excluded from the warn branch and retried at the same 4000. Detect MAX_TOKENS separately and retry with a higher cap.
- **wallclock-2** `index.ts:1675-1760` — streaming ID-validation issues up to 2 more 8000-token calls after the break before the L1896 persist; same exposure as wallclock-1, lower because streaming keeps resetting the idle timeout. Guard validation with the existing `wallClockStartMs`.

## LOW (12)
emptyresp-2 (no non-streaming empty retry — *handled elsewhere*), emptyresp-5 / errors-1 (raw error in SSE `details`), errors-4 (**API key in URL query string** — move to `x-goog-api-key` header, latent log/proxy leak), errors-5 (5xx classification has no bare-status fallback like 429 does), genconfig-6 (`gemini-2.5-flash` fallback string + inaccurate "silently ignored" comment — thinkingLevel on 2.5 errors), genconfig-7 (batch path defaults to Gemini-3 Flash "high" thinking — no cost control), loop-4/loop-5 (functionCall `id` dropped in shared helper; reminder/non-stream lack parallel branch), syscache-2 (response metadata only exposes round-1 cache count), toolschema-2 (`generate-chart` datasets items open-ended), wallclock-3 (comments mis-state Pro wall-clock as 150s — it's **400s**; 150s is the idle timeout).

---

## Refuted (13 false positives the verifiers killed)
Notably: **streaming-1..5** (SSE residual-buffer flush, UTF-8 boundary, `data:`-no-space, IIFE-not-in-waitUntil, swallowed error frame) all **NOT bugs** — Gemini `alt=sse` is newline-terminated single-line JSON, the native ReadableStream keeps the worker alive correctly, and the client terminates on `reader.read()` done not on a frame. **syscache-1** (webhook tool list changes between turns) — inherent/correct, mitigation already in place. **persist-2/3** (assistant-append missing cap/tenant filter) — refuted on mechanics. **loop-3** (A→B→A→B repeat-detection gap) — real description but over-stated severity; maxTurns + anti-loop prompt bound it.

## Verified Clean (highlights — 55 total)
Streaming temp **1.0** ✓ · thoughtSignature echoed **verbatim** across chunks (read from part *and* nested fc) ✓ · maxTurns 15 in all 4 loops ✓ · ANY mode bounded to one call ✓ · force-synthesis + last-resort string in all handlers ✓ · anti-loop rule in system prompt ✓ · wall-clock guards + `EdgeRuntime.waitUntil` + local-dev fallback ✓ · **system prompt static, current-time moved to user turn (implicit-cache prefix preserved)** ✓ · tool list built once/request ✓ · `cachedContentTokenCount` logged with hit-rate ✓ · `responseSchema` never combined with tools ✓ · tool schemas use only Gemini-supported keywords ✓ · append-mode never replaces array with client data ✓ · upsert `ignoreDuplicates` ✓ · cross-tenant block in helpers ✓.

---

## Completeness gaps (beyond the 7-check scope — uncovered surface)
- **HIGH** Multimodal image injection (`buildFunctionResponseParts` ~L709-767): model-chosen `image_url` fetched server-side with **no timeout, no size cap, no allowlist (SSRF-shaped)**; on fetch failure the model is still told "IMAGE LOADED SUCCESSFULLY" → hallucinated analysis.
- **HIGH** Token-gate accuracy: persisted `last_prompt_tokens` is a hand-rolled **estimate** (`firstRound.prompt + last.candidates`), not Gemini's real `promptTokenCount`; the 250K/80K gates treat an approximation as exact.
- **HIGH** Token billing double-counts: `billOrionTokensForRound` bills the full growing prefix every round → 5-10× over-charge on multi-tool turns; gate reads at start, increments fire-and-forget after → a 99%-budget user can fire many turns; a dropped waitUntil = unbilled turn.
- **HIGH** Tool latency inside the budget: wall-clock only checks at top-of-loop; one `include_summary` history call can fan out 5 unbounded Twelve Data fetches inside a single round.
- **HIGH** Native write-tool idempotency: only the webhook path has an idempotency key; the empty-bug retry re-sends the user turn → can **double-execute** `manage_note`/`manage_event`/etc.
- **HIGH** MCP errors returned as opaque text → model treats an outage as real data; expired-session retry recurses with no depth limit.
- **MEDIUM** Embedding/recall uses raw `GOOGLE_API_KEY`, bypassing the `apiKeyPool` backoff/quota protection.
- **MEDIUM** Tier gate: 2 uncached serial Postgres reads on every chat turn; fails *open* on budget read but *closed* on subscription read.
- **MEDIUM** `code_execution` plumbing in the prod bundle (env-gated): parser doesn't handle `executableCode`/`codeExecutionResult` parts → empty-bug detector misfires.
- **MEDIUM** `validateUserDataIsolation` is a regex over the serialized response, **non-streaming only** → path-asymmetric security + false-positive 403s.
- **MEDIUM** Empty-bug retry mutates the message + filters to a stale hardcoded tool allowlist (references tool names that no longer exist).
- **MEDIUM** Webhook rate counter / read-only cache / tier cache are in-process Maps → wrong under multi-isolate scaling (caps are advisory, not enforced).
- **LOW** Per-turn tag-chip + invalid-ref regex post-processing is O(tags × length) on the hot path.

---

## Deploy-risk checklist
- **Before relying on reminders / non-streaming at scale:** fix loop-1 + thoughtsig-1/2 (parallel calls) and persist-1 (lost-update race).
- **Before scaling chat:** genconfig-2/3 (temp/token), emptyresp-1 (synthesis can be empty), wallclock-1.
- **Cannot verify from code:** the actual `GEMINI_MODEL`, `temperature`, and thinking env values in Supabase secrets — confirm `GEMINI_MODEL=gemini-3-flash-preview` is set (else the `2.5-flash` fallback + Gemini-3 `thinkingLevel` → 400 on every call).
