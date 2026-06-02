export const meta = {
  name: 'orion-gemini-audit',
  description: 'Audit Orion (ai-trading-agent) against official Google Gemini + Supabase Edge docs',
  phases: [
    { title: 'Ground Truth', detail: 'Fetch + distill official Gemini & Supabase docs' },
    { title: 'Audit', detail: '10 code dimensions vs the 7-check framework' },
    { title: 'Verify', detail: 'Adversarially re-check each finding against real code' },
    { title: 'Completeness', detail: 'What audit-relevant surface was missed' },
  ],
}

const ROOT = 'c:\\Users\\Izzy\\Documents\\Projects\\simple-trade-tracker'

// The DEPLOYED model is confirmed by the operator. Audit against THIS, not the
// `gemini-2.5-flash` default string baked into the code as a fallback.
const DEPLOYED = `DEPLOYED MODEL (confirmed by operator): GEMINI_MODEL = "gemini-3-flash-preview".
Implications for this audit:
- thinkingLevel (minimal/low/medium/high) is a VALID Gemini-3 control on this model.
- thoughtSignature round-trip is MANDATORY (Gemini 3.x emits it) - a dropped signature = 400 on the next call.
- Temperature-1.0 guidance applies (Gemini 3). A sub-1.0 temp on a tool-using AUTO path is a real risk.
- The "gemini-2.5-flash" string in getDefaultGeminiModel()/MODEL is only a FALLBACK when GEMINI_MODEL is unset;
  in prod it is NOT used. Treat a hardcoded 2.5 fallback as a LATENT risk (cost mis-pricing / wrong thinking
  semantics if the env var is ever cleared), not a live production bug.`

// ---------------- Schemas ----------------
const DOC_RULES_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rule: { type: 'string', description: 'A concrete, testable rule the code must follow' },
          citation: { type: 'string', description: 'Doc URL this rule comes from' },
          why_it_matters: { type: 'string' },
        },
        required: ['rule', 'citation'],
      },
    },
    key_facts: {
      type: 'array',
      items: { type: 'string' },
      description: 'Hard numbers/defaults: temperature default, token limits, wall-clock seconds, etc.',
    },
  },
  required: ['area', 'rules', 'key_facts'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          file: { type: 'string' },
          line: { type: 'string' },
          issue: { type: 'string' },
          code_evidence: { type: 'string', description: 'Actual quoted code proving the issue' },
          fix: { type: 'string' },
          doc_citation: { type: 'string', description: 'Doc URL or rule justifying this is wrong' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['id', 'severity', 'file', 'line', 'issue', 'code_evidence', 'fix', 'doc_citation', 'confidence'],
      },
    },
    verified_clean: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          check: { type: 'string' },
          why: { type: 'string' },
          citation: { type: 'string' },
        },
        required: ['check', 'why'],
      },
    },
  },
  required: ['dimension', 'findings', 'verified_clean'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    finding_id: { type: 'string' },
    is_real: { type: 'boolean', description: 'Is this a genuine issue in the CURRENT code, not handled elsewhere?' },
    handled_elsewhere: { type: 'boolean', description: 'True if the concern is actually mitigated at another line/file' },
    verdict_reasoning: { type: 'string', description: 'Cite the exact lines you re-read to confirm or refute' },
    corrected_severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NOT_A_BUG'] },
    corrected_fix: { type: 'string' },
  },
  required: ['finding_id', 'is_real', 'handled_elsewhere', 'verdict_reasoning', 'corrected_severity'],
}

// ---------------- Phase 1: Ground Truth ----------------
phase('Ground Truth')

const DOC_TARGETS = [
  {
    key: 'gemini-fc',
    area: 'Gemini Function Calling',
    prompt: `Fetch and read the official Google Gemini function-calling documentation at
https://ai.google.dev/gemini-api/docs/function-calling
Extract the AUTHORITATIVE rules a multi-turn function-calling agent loop MUST follow:
- tool_config modes (AUTO/ANY/NONE) and their documented risks
- how the model turn must be echoed back on continuation: the requirement to return the model's
  functionCall part VERBATIM, including thoughtSignature for Gemini 3.x, and the 400 INVALID_ARGUMENT
  "missing thought_signature" error if reconstructed
- parallel function calls handling
- the exact shape of functionResponse parts
- any guidance on avoiding tool-call loops
Give exact rules each with the doc URL. Include hard facts in key_facts.`,
  },
  {
    key: 'gemini-thinking-config',
    area: 'Gemini Thinking + Generation Config + Models',
    prompt: `Fetch and read these official Google Gemini docs:
- https://ai.google.dev/gemini-api/docs/thinking (thinking config)
- https://ai.google.dev/gemini-api/docs/text-generation (generationConfig + streaming)
- https://ai.google.dev/gemini-api/docs/models (model IDs / families)
Extract authoritative rules + HARD NUMBERS on:
- the default temperature value and Google's guidance on lowering it (especially with tools)
- thinkingLevel vs thinkingBudget (which models support which - Gemini 3 vs 2.5), includeThoughts,
  and how thinking tokens consume the output-token budget (high thinking + small maxOutputTokens interaction)
- maxOutputTokens defaults/limits
- whether responseSchema / structured output can be combined with tools
- topP / topK defaults
- mediaResolution, seed
Note which thinking controls are Gemini-3-only vs 2.5. Cite a doc URL per rule.`,
  },
  {
    key: 'gemini-known-bugs',
    area: 'Gemini Known Failure Modes',
    prompt: `Use WebFetch/WebSearch to gather the documented Gemini failure modes for a tool-using chat agent:
(1) empty response text after several tool calls -
    https://discuss.ai.google.dev/t/gemini-2-5-pro-with-empty-response-text/81175
(2) infinite tool-call loop with function_calling_config mode=ANY -
    https://discuss.ai.google.dev/t/infinite-tool-call-loop-when-setting-function-calling-config-to-any-mode/97307
(3) production loop-prevention recipe -
    https://github.com/google-gemini/gemini-cli/discussions/23240
Extract the documented CAUSES and the documented MITIGATIONS (maxOutputTokens bump, retry with context,
force-synthesis with mode=NONE, last-resort user-visible fallback, anti-loop system-prompt rules,
same-call detection). Give concrete rules + URLs.`,
  },
  {
    key: 'supabase-edge',
    area: 'Supabase Edge Function Limits',
    prompt: `Fetch and read these official Supabase docs:
- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/functions/background-tasks
- https://supabase.com/docs/guides/troubleshooting/edge-function-wall-clock-time-limit-reached-Nk38bW
- https://supabase.com/docs/guides/troubleshooting/edge-function-cpu-limits
Extract HARD NUMBERS + rules:
- the wall-clock limit for initial requests (Free AND Pro), and whether it can be raised
- how long background tasks (EdgeRuntime.waitUntil) may run on Free vs Pro
- the CPU-time limit
- the correct EdgeRuntime.waitUntil pattern for persistence that must survive past the response window
- the documented shutdown reasons
Cite the doc URL per rule. Put the numbers in key_facts.`,
  },
]

const docResults = await parallel(
  DOC_TARGETS.map((d) => () =>
    agent(d.prompt, { label: `docs:${d.key}`, phase: 'Ground Truth', schema: DOC_RULES_SCHEMA })
  )
)

const docRules = docResults
  .filter(Boolean)
  .map((r) => {
    const rules = (r.rules || []).map((x) => `  - ${x.rule}  [${x.citation}]`).join('\n')
    const facts = (r.key_facts || []).map((f) => `  * ${f}`).join('\n')
    return `### ${r.area}\nKEY FACTS:\n${facts}\nRULES:\n${rules}`
  })
  .join('\n\n')

log(`Ground truth gathered from ${docResults.filter(Boolean).length}/4 doc sources`)

// ---------------- Dimensions ----------------
const DIMENSIONS = [
  {
    key: 'genconfig',
    title: 'Generation Config (temperature / maxOutputTokens / thinking / topP / model)',
    files: `- supabase/functions/_shared/gemini.ts L114-192 (callGemini body: temperature default 0.3, maxOutputTokens default 8192, thinkingConfig)
- supabase/functions/ai-trading-agent/index.ts L60-100 (MODEL default gemini-2.5-flash, THINKING_LEVEL, resolveChatThinkingLevel), L185-215 (buildGenerationConfig: temperature 1.0, mediaResolution, seed, thinkingConfig), L440-500 (callGeminiStreaming opts, maxOutputTokens default 4000) and call sites L1599/L1737 (8000), L1643/L2336/L2988 (4000, mode NONE), L3102 (8000)
- supabase/functions/_shared/orionAgent.ts L85-220 (maxOutputTokens 4000, thinkingLevel medium)
- supabase/functions/run-orion-task/gemini.ts (batch briefing generation config)
- supabase/functions/_shared/geminiCost.ts L25-40 (which model IDs the project prices - signals the real deployed model)`,
    focus: `Check EVERY generationConfig call site.
(1) Is any interactive/tool-using chat path running temperature < 1.0? The shared gemini.ts defaults to 0.3 and orionAgent.ts relies on it - trace who calls these and with what temperature, and whether any are tool-using/AUTO-mode paths (project guidance + Gemini docs: keep temp at 1.0 with AUTO tools to avoid loops). A 0.3 default is fine ONLY for strict structured-output (responseSchema/JSON) calls - distinguish those.
(2) maxOutputTokens: any chat/tool path < 4000? Does high thinkingLevel + a 4000 cap risk squeezing visible text (a documented Gemini empty-content cause)?
(3) Model mismatch: MODEL/getDefaultGeminiModel default to "gemini-2.5-flash" but the code passes Gemini-3-only thinkingLevel (minimal/low/medium/high) and geminiCost prices gemini-3-*. Flag the default-string risk if GEMINI_MODEL is unset.
(4) topP/topK custom values combined with low temp? mediaResolution / seed correctness. Quote exact lines.`,
  },
  {
    key: 'loop',
    title: 'Function-Calling Loop Correctness',
    files: `- supabase/functions/ai-trading-agent/index.ts L1271-1700 (streaming chat loop), L2270-2400 (reminder loop), L2870-3050 (non-streaming loop)
- supabase/functions/_shared/orionAgent.ts L150-230 (batch loop, initialToolMode ANY on turn 1 then AUTO)
- repeated-call detection at index.ts L1519-1523, L2298-2301, L2920-2924`,
    focus: `Audit each of the FOUR loops against the function-calling rules.
(1) maxTurns cap present (15)?
(2) Repeated-call detection only compares against the LAST call (functionCalls[length-1]). Does this miss A->B->A->B oscillation or repeats separated by a turn? Assess against the documented loop-prevention recipe.
(3) Are PARALLEL function calls (multiple functionCall parts in one turn) handled - all executed and all responses returned in order?
(4) tool_config mode transitions: orionAgent forces ANY on turn 1 - is there a time/turn-bound exit so ANY can never loop infinitely (documented ANY-mode infinite loop)? Does the chat streaming loop ever use ANY without an exit?
(5) Is there anti-loop guidance in the system prompt when mode=AUTO (cross-check systemPrompt.ts)? Quote exact lines.`,
  },
  {
    key: 'thoughtsig',
    title: 'thoughtSignature / rawParts round-trip (Gemini 3.x)',
    files: `- supabase/functions/ai-trading-agent/index.ts L380-435 (ParsedFunctionCall, parseFunctionCallFromPart, buildModelParts fallback), L505-575 (a streamer), L1040-1219 (main streamGeminiResponse part accumulation across chunks), L1490-1620 (streaming continuation echo), L2325-2345 (reminder continuation), L2961-2997 (non-streaming continuation)
- supabase/functions/_shared/orionAgent.ts L170-180 (echo result.rawParts verbatim)
- supabase/functions/_shared/gemini.ts L88-107 (extractFunctionCalls), L180-192`,
    focus: `Verify the model turn is ALWAYS echoed back VERBATIM via rawParts on continuation, never reconstructed from {name,args} (reconstruction drops thoughtSignature -> 400 on next call).
(1) At EVERY continuation site, confirm rawParts is pushed as the model turn and the buildModelParts fallback (L422-432) is only a last resort.
(2) In streaming, confirm ALL raw parts are accumulated across SSE chunks (thoughtSignature may arrive on a separate part/chunk) - check the accumulation at L1052-1153 doesn't drop or overwrite parts.
(3) Confirm thoughtSignature is read from BOTH the part itself and nested in functionCall.
(4) Any path that builds a model turn from parsed calls instead of rawParts (forced synthesis, validation retries) - does it risk dropping thoughtSignature? Quote exact lines.`,
  },
  {
    key: 'wallclock',
    title: 'Wall-Clock Budget + Edge persistence survival',
    files: `- supabase/functions/ai-trading-agent/index.ts L1298-1300 + L1413-1430 (streaming wall-clock guard 130_000), L1817-1900 (persist via EdgeRuntime.waitUntil + done SSE), L2274-2285 (reminder guard), L2468-2475 (embed waitUntil), L2880-2905 (non-stream guard), L3200-3247 (non-stream persist waitUntil)
- supabase/functions/ai-trading-agent/tools/recall-conversations.ts L885-925 (background embed budget)`,
    focus: `Against the Supabase edge limits ground truth:
(1) Is the 130_000ms budget correct given the real wall-clock limit, and does it leave enough headroom (~20s) for the force-synthesis call + persist?
(2) Is the assistant-message persist ALWAYS wrapped in EdgeRuntime.waitUntil so it survives past the response close - in ALL THREE handlers (streaming, reminder, non-streaming)?
(3) On wall-clock break, does force-synthesis still get to run, or could the break skip past synthesis leaving a silent turn?
(4) Is there a local-dev fallback (await) when EdgeRuntime is absent?
(5) Any heavy await AFTER the response/stream should have closed that the platform could kill?
(6) Background-task duration: does a slow embed/persist risk exceeding the background-task limit? Quote exact lines + cite the Supabase doc numbers.`,
  },
  {
    key: 'emptyresp',
    title: 'Empty-Response Handling',
    files: `- supabase/functions/ai-trading-agent/index.ts L1216 (emptyBug flag), L1300-1370 (empty retry), L1631-1665 (force-synthesis mode=NONE streaming), L2350-2360 (reminder synthesis), L3003-3045 (non-stream synthesis + last-resort)
- supabase/functions/_shared/orionAgent.ts (forcedSynthesis + never-empty fallback)
- supabase/functions/ai-trading-agent/formatters.ts (where emptyBug/empty text is surfaced)`,
    focus: `Trace EVERY exit path from a Gemini call to the final persisted assistant message. Per the empty-content ground truth, confirm:
(1) emptyBug flag from the response parser triggers a retry path.
(2) A force-synthesis fallback (tool_config mode=NONE + "summarise everything, do not call tools" prompt) exists in ALL handlers.
(3) If synthesis ALSO returns empty, is there a last-resort user-visible fallback string so the chat is NEVER silent (DB never ends with only the user message)?
(4) Does the retry/synthesis itself respect the wall-clock budget?
Identify any path where the model returns empty and NO user-visible text is persisted. Quote exact lines.`,
  },
  {
    key: 'persist',
    title: 'Persistence Path (append-mode, atomic guard, tenancy)',
    files: `- supabase/functions/ai-trading-agent/conversationStore.ts L110-265 (appendUserMessage: upsert ignoreDuplicates, read, append, .lt last_prompt_tokens cap), L320-380 (appendAssistantMessage: read message_count, append, update)
- supabase/functions/ai-trading-agent/index.ts L2100-2160 + L2400-2445 (inline persist + atomic cap guard), L1860-1900 (streaming persist), L3220-3250 (non-stream persist)`,
    focus: `Against the persistence checklist:
(1) Append-mode - reads existing messages array, pushes, UPDATEs (never replaces the whole array with client data)?
(2) Atomic UPDATE with a cap guard (.lt on last_prompt_tokens or message_count) to survive a two-tab race? Is the guard atomic, or is there a read-then-write TOCTOU window where two concurrent turns both read currentCount and both write count+1 (lost update)?
(3) Defense-in-depth user_id filter even with the service-role client (cross-tenant write block)?
(4) UPSERT uses ignoreDuplicates:true so a re-send with same conversation_id doesn't wipe prior messages?
(5) Error path persists a user-visible error rather than failing silently? Quote exact lines.`,
  },
  {
    key: 'errors',
    title: 'Provider Error Handling + secret hygiene',
    files: `- supabase/functions/ai-trading-agent/formatters.ts L14-130 (classifyProviderError, formatErrorResponse)
- supabase/functions/_shared/gemini.ts L109-178 (retry on 429/5xx, error throw with status+body, API key in URL query string L121)
- supabase/functions/ai-trading-agent/index.ts L1925-1945 (classify in stream path), L3255-3265 (formatErrorResponse non-stream)`,
    focus: `(1) Are 503 / 429 / RESOURCE_EXHAUSTED mapped to friendly "high demand, try again" text rather than raw errors?
(2) Does the throw at gemini.ts L177 embed the raw provider body (could contain internal detail), and does any path surface that raw string to the USER or log it at info level?
(3) Do tool-execution errors return a string the model can reason about (e.g. "rate limit, try smaller query") rather than a raw exception/stack?
(4) Any raw SQL, table names, internal paths, API keys, project refs, or service-role JWTs reachable in user-visible errors or info logs? The Gemini URL puts the API key in the query string (gemini.ts L121) - assess log-leak risk. Quote exact lines.`,
  },
  {
    key: 'syscache',
    title: 'System Prompt static-first / KV-cache plumbing',
    files: `- supabase/functions/ai-trading-agent/systemPrompt.ts (read in chunks - 960 lines; look for date/time/now/Date/timestamp/minute injection)
- supabase/functions/ai-trading-agent/index.ts - where the system prompt is built/passed (grep buildSystemPrompt / systemInstruction) and where current date/session-time is injected (system block vs per-turn user message)
- supabase/functions/_shared/gemini.ts L140-149 (systemInstruction + tools/tool_config placement)`,
    focus: `This is a CACHE-PLUMBING audit, NOT a prompt-content-quality audit (do not rewrite prompt copy).
(1) Is the systemInstruction STATIC across a conversation - no per-turn timestamps / minute-granularity strings / changing user state embedded inside the system block (which would bust implicit/KV cache every turn)? If current date/time is needed, is it injected in the per-turn USER message instead?
(2) Is the tool list STATIC across turns of one conversation (a changing tool list mid-conversation breaks the cache prefix)? Check whether tools are conditionally added/removed between turns (webhook custom tools, tier-gated tools).
(3) Is cachedContentTokenCount from usageMetadata actually logged/metered to confirm implicit cache hits? Quote exact lines.`,
  },
  {
    key: 'streaming',
    title: 'Streaming SSE parsing correctness',
    files: `- supabase/functions/ai-trading-agent/index.ts L505-575 (streamer A), L1040-1219 (main streamGeminiResponse), L585-600 (SSE event type union), L1817-1860 (done event)`,
    focus: `Audit the SSE reader for Gemini streaming (streamGenerateContent?alt=sse).
(1) Does the parser correctly handle partial/split chunks - a JSON object spanning two network reads, multiple "data:" lines per chunk, and buffer carry-over between reads? Or could a split boundary drop/corrupt a part?
(2) Are thought parts (thinkingConfig.includeThoughts) correctly separated from visible text (p.thought filter) and emitted as reasoning_chunk, not mixed into the answer?
(3) Is usageMetadata captured from the LAST chunk (lastUsageMetadata) reliably?
(4) Are functionCall parts during streaming accumulated without loss?
(5) Writer lifecycle - is the SSE writer always closed (even on error/throw) so the client stream never hangs? Quote exact lines.`,
  },
  {
    key: 'toolschema',
    title: 'Tool / responseSchema correctness',
    files: `- supabase/functions/ai-trading-agent/tools.ts (function_declarations assembly)
- supabase/functions/_shared/gemini.ts L123-149 (responseSchema + tools mutual exclusion), L57-58
- any tool/responseSchema using open-ended object fields (grep responseSchema / responseMimeType)`,
    focus: `(1) Confirm responseSchema (structured output) is NEVER sent together with tools/function_declarations in the same request (the Gemini API rejects the combo). gemini.ts builds both conditionally - verify no caller passes both.
(2) Are function_declarations parameter schemas valid (type/properties/required well-formed, no unsupported JSON-schema keywords Gemini rejects)?
(3) The project has a documented Gemini responseSchema hang on generic open-ended type:"object" fields (emit as JSON-encoded string instead) - verify no responseSchema in the agent path reintroduces an open-ended object property. Quote exact lines.`,
  },
]

phase('Audit')

const auditResults = await pipeline(
  DIMENSIONS,
  // Stage 1: audit a dimension
  (d) =>
    agent(
      `You are an AI-infrastructure auditor reviewing the Orion AI agent - a Gemini-powered Supabase Edge Function
(ai-trading-agent) that runs a multi-turn function-calling chat loop for a trading-journal app.
You audit CODE + CONFIG against OFFICIAL DOCS only. No praise. Every finding cites a doc URL/rule or is dropped.

REPO ROOT: ${ROOT}
Read files with the Read tool (use offset/limit on big files like index.ts) and Grep for cross-references.

${DEPLOYED}

AUDIT DIMENSION: ${d.title}

TARGET CODE:
${d.files}

WHAT TO CHECK:
${d.focus}

OFFICIAL DOC GROUND TRUTH (cite these; fetch more yourself if needed):
${docRules}

METHOD: Open the cited code and READ the actual lines (and surrounding context) before judging.
For each issue, quote the REAL code as code_evidence and give an exact file:line.
Mark compliant items as verified_clean. Severity: CRITICAL=silent data loss / ship-blocker;
HIGH=common-case model failure (loops, empty replies, 400s); MEDIUM=edge case / efficiency / cache miss; LOW=style/token-burn.
Use ids like "${d.key}-1". Be exhaustive but do not invent issues.`,
      { label: `audit:${d.key}`, phase: 'Audit', schema: FINDINGS_SCHEMA }
    ),
  // Stage 2: adversarially verify each finding from that dimension
  (review, d) =>
    parallel(
      (review.findings || []).map((f) => () =>
        agent(
          `You are a SKEPTICAL verifier. A prior auditor flagged an issue in the Orion ai-trading-agent edge function.
Your job is to REFUTE it by re-reading the ACTUAL current code. Default to is_real=false unless you can quote the
specific lines that prove the issue is real AND not already handled elsewhere.

REPO ROOT: ${ROOT}
Use Read on the cited file at the cited line range, and Grep to check whether the concern is mitigated nearby
(a guard, a fallback, a wrapper, a different call site).

CLAIMED FINDING:
  id: ${f.id}
  severity: ${f.severity}
  file: ${f.file}
  line: ${f.line}
  issue: ${f.issue}
  code_evidence(claimed): ${f.code_evidence}
  proposed_fix: ${f.fix}
  doc_citation: ${f.doc_citation}

${DEPLOYED}

RELEVANT DOC GROUND TRUTH:
${docRules}

Decide: is_real (genuine bug in current code), handled_elsewhere (mitigated at another line), and a corrected_severity
(use NOT_A_BUG if refuted). In verdict_reasoning, quote the exact lines you re-read. If the auditor mis-cited the line or
the code actually does the right thing, say so plainly.`,
          { label: `verify:${f.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }
        ).then((v) => ({ finding: f, verdict: v }))
      )
    ).then((verdicts) => ({
      dimension: d.title,
      key: d.key,
      verified_clean: review.verified_clean || [],
      results: (verdicts || []).filter(Boolean),
    }))
)

// ---------------- Phase 4: Completeness critic ----------------
phase('Completeness')

const coveredList = DIMENSIONS.map((d) => `- ${d.title}`).join('\n')
const COMPLETENESS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          file: { type: 'string' },
          why_it_matters: { type: 'string' },
          suggested_severity_if_broken: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
        },
        required: ['area', 'why_it_matters'],
      },
    },
  },
  required: ['gaps'],
}

const completeness = await agent(
  `You are a completeness critic for an AI-infrastructure audit of the Orion ai-trading-agent Supabase Edge Function
(a Gemini-powered multi-turn function-calling chat agent). The audit covered these dimensions:
${coveredList}

REPO ROOT: ${ROOT}
Explore supabase/functions/ai-trading-agent and supabase/functions/_shared (Read/Grep). Identify audit-relevant surfaces,
config, or failure modes that the dimensions above DID NOT cover and that could affect correctness, cost, latency, or
data integrity of the Gemini agent. Examples to consider: image/multimodal part injection (analyze_image), candle/price
tool latency inside the wall-clock budget, embedding/recall paths, the API-key pool draining, tier enforcement on the hot
path, code_execution / server-side tool config, idempotency of tool calls, conversation token-gate accuracy.
For each gap, name the file + why it matters. Be specific; do not repeat covered items.`,
  { label: 'completeness', phase: 'Completeness', schema: COMPLETENESS_SCHEMA }
)

// ---------------- Assemble ----------------
const confirmed = []
const refuted = []
for (const dim of auditResults.filter(Boolean)) {
  for (const r of dim.results) {
    const real = r.verdict && r.verdict.is_real && r.verdict.corrected_severity !== 'NOT_A_BUG'
    const row = {
      dimension: dim.dimension,
      id: r.finding.id,
      severity: (r.verdict && r.verdict.corrected_severity) || r.finding.severity,
      file: r.finding.file,
      line: r.finding.line,
      issue: r.finding.issue,
      code_evidence: r.finding.code_evidence,
      fix: (r.verdict && r.verdict.corrected_fix) || r.finding.fix,
      doc_citation: r.finding.doc_citation,
      reasoning: r.verdict && r.verdict.verdict_reasoning,
      handled_elsewhere: r.verdict && r.verdict.handled_elsewhere,
    }
    if (real) confirmed.push(row)
    else refuted.push(row)
  }
}

const verifiedClean = auditResults
  .filter(Boolean)
  .flatMap((dim) => (dim.verified_clean || []).map((c) => ({ dimension: dim.dimension, ...c })))

return {
  summary: {
    dimensions_audited: DIMENSIONS.length,
    confirmed_count: confirmed.length,
    refuted_count: refuted.length,
    by_severity: {
      CRITICAL: confirmed.filter((c) => c.severity === 'CRITICAL').length,
      HIGH: confirmed.filter((c) => c.severity === 'HIGH').length,
      MEDIUM: confirmed.filter((c) => c.severity === 'MEDIUM').length,
      LOW: confirmed.filter((c) => c.severity === 'LOW').length,
    },
  },
  confirmed,
  refuted,
  verified_clean: verifiedClean,
  completeness_gaps: (completeness && completeness.gaps) || [],
}
