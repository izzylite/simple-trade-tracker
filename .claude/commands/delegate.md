---
name: delegate-to-subagent
description: Automatically delegate the user's request to the most appropriate specialized subagent
---

Analyze the user's request and delegate to the best matching subagent.

## Available Subagents

1. **pragmatic-code-review** - Code quality reviews, best practices, security audits [uses Playwright]
2. **design-review** - UI/UX reviews, visual consistency, accessibility compliance [uses Playwright]
3. **edge-function-reviewer** - Supabase Edge Function review for Deno/TypeScript correctness and security
4. **frontend-developer** - React components, responsive layouts, client-side state management
5. **supabase-backend-expert** - Database design, RLS policies, edge functions, Supabase operations [uses Supabase MCP]
6. **validation-gates** - Testing, quality assurance, test automation

## Decision Rules

**Delegate when** the request matches a subagent's domain expertise or requires specialized review.

**Handle directly when** the task is simple (file edits, quick fixes, one-time scripts, general queries).

**Multi-agent coordination**: If the request spans multiple domains (e.g., "build a feature with UI and database changes"), launch relevant agents in parallel using the Agent tool.

## Execution

1. Read the matching agent definition from `.claude/agents/<name>.md`
2. Launch the agent via the Agent tool with full context about the user's request
3. Report the result back to the user
