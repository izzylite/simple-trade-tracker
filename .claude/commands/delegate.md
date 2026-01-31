---
name: delegate-to-subagent
description: Automatically delegate the user's request to the most appropriate specialized subagent
---

I'll analyze your request and delegate it to the most appropriate specialized subagent for optimal handling.

## Task Analysis
First, let me understand what you're asking for:
- **Request**: {{REQUEST}}

## Subagent Selection Process

### Step 1: Check Existing Specialized Subagents
Let me evaluate which existing subagent best matches your needs by reading from the agent registry:

<reads .claude/agents/registry.json to get current agent list>

#### Available Specialized Subagents:
<!-- This list is dynamically generated from registry.json -->
1. **crewai-specialist**: CrewAI framework, multi-agent systems, agent optimization
2. **supabase-backend-expert**: Database design, RLS policies, edge functions, Supabase operations [MCP: supabase-mcp]
3. **frontend-developer**: React components, responsive layouts, client-side state management
4. **documentation-manager**: Documentation updates, README maintenance, technical docs
5. **pragmatic-code-review**: Code quality reviews, best practices, security audits [MCP: playwright]
6. **design-review**: UI/UX reviews, visual consistency, accessibility compliance [MCP: playwright]
7. **validation-gates**: Testing, quality assurance, test automation
8. **task-orchestrator**: Task coordination, dependency management, parallel execution [MCP: task-master-ai]
9. **task-executor**: Individual task implementation and completion [MCP: task-master-ai]
10. **task-checker**: Task verification and quality assurance [MCP: task-master-ai]
11. **subagent-factory**: Dynamic subagent creation specialist
<!-- Custom agents will be appended here automatically -->

### Step 2: Match Request to Subagent
Based on your request about "{{REQUEST}}", I'm analyzing which subagent would be most appropriate...

{{#if MATCHING_SUBAGENT}}
✅ **Perfect Match Found**: {{MATCHING_SUBAGENT}}
This subagent specializes in exactly what you need.

I'll now delegate your request to the {{MATCHING_SUBAGENT}} agent with the following prompt:
```
{{DELEGATION_PROMPT}}
```

{{else}}
⚠️ **No Existing Subagent Match**

### Step 3: Assess Task Complexity
Before deciding on the approach, let me evaluate task complexity:

#### Complexity Criteria Analysis:
- **Scope**: Is this a single operation or a complex feature/system?
- **Technical Depth**: Does it require specialized domain expertise?
- **Repeatability**: Is this a one-time need or ongoing requirement?
- **Integration Complexity**: Does it involve complex multi-service integrations or external APIs?
- **Workflow Complexity**: Does it require multi-step coordination or orchestration?
- **Long-term Value**: Will this capability be useful for future tasks?

#### Decision Matrix:

**✅ HANDLE DIRECTLY if:**
- Simple file operations (read, write, basic edits)
- Quick code fixes or modifications
- Straightforward feature implementations
- General queries or status checks
- One-time tasks with standard tools
- No external API integrations needed
- Can be completed with existing tools in < 30 minutes

**🏭 CREATE SPECIALIZED AGENT if:**
- Requires deep domain expertise (payment processing, complex ML, etc.)
- Involves complex multi-service integrations
- Needs custom MCP tools for external APIs
- Will be used repeatedly for similar tasks
- Requires orchestration of multiple complex operations
- Involves proprietary systems or protocols
- Benefits from dedicated tooling and workflows

{{#if BASIC_TASK}}
✅ **Basic Task - Direct Handling**

This is a straightforward task that doesn't warrant creating a specialized agent. I'll handle it directly using my standard tools and capabilities.

**Reasoning**: {{DIRECT_HANDLING_REASON}}

Proceeding with the task now...

{{else}}
🏭 **Complex Task - Creating Specialized Agent**

This task meets the criteria for creating a specialized agent because:
{{COMPLEXITY_JUSTIFICATION}}

I'll invoke the **subagent-factory** to create a specialized subagent tailored to your needs:

#### Custom Subagent Requirements:
- **Domain**: {{IDENTIFIED_DOMAIN}}
- **Expertise Needed**: {{REQUIRED_EXPERTISE}}
- **Tools Required**: {{REQUIRED_TOOLS}}
- **MCP Tools Needed**: {{MCP_TOOLS_NEEDED}}
- **Integration Points**: {{INTEGRATION_NEEDS}}
- **Expected Reusability**: {{REUSABILITY}}

Let me create this custom subagent for you...

```
Creating specialized subagent: {{CUSTOM_SUBAGENT_NAME}}
Configuration:
- Primary Focus: {{PRIMARY_FOCUS}}
- Secondary Skills: {{SECONDARY_SKILLS}}
- Tool Access: {{TOOL_ACCESS}}
- MCP Tools: {{MCP_TOOLS}}
- Knowledge Base: {{KNOWLEDGE_BASE}}
```
{{/if}}
{{/if}}

## Delegation Execution

{{#if MULTIPLE_SUBAGENTS_NEEDED}}
### Multi-Agent Coordination Required
Your request requires coordination between multiple specialized subagents:

1. **Primary Agent**: {{PRIMARY_AGENT}} - {{PRIMARY_TASK}}
2. **Secondary Agent**: {{SECONDARY_AGENT}} - {{SECONDARY_TASK}}
{{#if TERTIARY_AGENT}}
3. **Support Agent**: {{TERTIARY_AGENT}} - {{SUPPORT_TASK}}
{{/if}}

I'll orchestrate these agents in the optimal sequence for your task.
{{/if}}

### Launching Subagent(s)
<uses Task tool to launch the appropriate subagent(s) with detailed context>

## Dynamic Agent Registry

The system maintains a dynamic registry of all available agents:
- **Built-in Agents**: Pre-configured specialists with proven capabilities
- **Custom Agents**: Dynamically created agents for specific requirements
- **MCP Tools**: External integrations available to each agent

When new agents are created, they're automatically added to the registry and become available for future delegations.

## Subagent Factory Protocol

If no existing subagent matches, I'll use the **subagent-factory** with this protocol:

```yaml
subagent_request:
  name: {{CUSTOM_SUBAGENT_NAME}}
  domain: {{DOMAIN}}
  capabilities:
    primary: {{PRIMARY_CAPABILITIES}}
    secondary: {{SECONDARY_CAPABILITIES}}
  tools_required: {{TOOLS_LIST}}
  mcp_tools_needed: {{MCP_TOOLS}}  # External APIs/services
  knowledge_sources: {{KNOWLEDGE_SOURCES}}
  integration_requirements: {{INTEGRATIONS}}
  performance_metrics: {{METRICS}}
  constraints: {{CONSTRAINTS}}
```

### MCP Tool Creation (Only When Essential)
**IMPORTANT**: MCP tools are created ONLY for:
- FREE services or those requiring only LLM API keys
- When ESSENTIAL to the agent's core expertise (like supabase-mcp for Supabase expert)

**For PAID services** (Stripe, Shopify, AWS, etc.):
- Use **WebFetch** for HTTP API calls
- Use **Bash** for CLI tools
- Do NOT create MCP tools

**If justified, the process**:
1. **mcp-tool-builder** validates cost (must be FREE/LLM_API_KEY)
2. Creates MCP configuration if justified
3. Installs to C:\Users\izzy\.claude.json
4. Links to agent in registry

**Examples**:
- ✅ GitHub integration → Create github-mcp (FREE + ESSENTIAL)
- ❌ Stripe integration → Use WebFetch (PAID service)

## Task Delegation Rules

### Always Delegate When:
1. User request matches a specialized domain (database, frontend, testing, etc.)
2. Task requires deep expertise in a specific technology
3. Multiple specialized skills are needed (invoke multiple agents)
4. User explicitly asks for review, testing, or documentation

### Create New Subagent ONLY When:
1. **Complex Domain Expertise Required**: Payment processing, complex ML pipelines, blockchain integration, etc.
2. **External API Integration**: Requires custom MCP tools for services like Stripe, Shopify, AWS, etc.
3. **High Reusability**: Will be needed repeatedly for similar tasks
4. **Multi-Service Orchestration**: Complex workflows involving multiple external services
5. **Specialized Tooling Benefits**: Task benefits significantly from dedicated tools and workflows
6. **Time Complexity**: Task would take > 30 minutes with standard approach

### Direct Handling When (NO agent creation):
1. **Simple File Operations**: Read, write, edit, basic modifications
2. **Quick Code Fixes**: Bug fixes, simple refactoring, formatting
3. **Straightforward Features**: Standard CRUD operations, simple API endpoints
4. **General Queries**: Status checks, information retrieval, documentation
5. **One-Time Tasks**: Unlikely to be repeated
6. **Standard Tools Sufficient**: Can be completed with existing tools efficiently
7. **User Explicitly Asks**: User wants main agent to handle directly

## Example Delegations

### Example 1: Database Task (Delegate to Existing Agent)
**User**: "Create a new table for user sessions with proper security"
**Decision**: → Delegate to supabase-backend-expert (perfect match)
**Reason**: Existing agent specializes in this exact domain

### Example 2: Simple Edit (Direct Handling)
**User**: "Fix the typo in the README file"
**Decision**: → Handle directly
**Reason**: Simple one-time file edit, no specialized expertise needed

### Example 3: Basic Feature (Direct Handling)
**User**: "Add a new API endpoint to get user profile"
**Decision**: → Handle directly
**Reason**: Straightforward CRUD operation, standard tools sufficient

### Example 4: Complex Multi-Service Feature (Delegate to Multiple Agents)
**User**: "Implement real-time collaborative editing"
**Decision**: → Delegate to multiple agents:
  1. frontend-developer (UI components)
  2. supabase-backend-expert (real-time subscriptions)
  3. validation-gates (testing)
**Reason**: Requires coordinated expertise from multiple domains

### Example 5: Novel Complex Integration (Create New Agent - NO MCP)
**User**: "Integrate with Stripe payment processing for subscription billing"
**Decision**: → Create stripe-payment-specialist via subagent-factory (WITHOUT MCP tools)
**Reason**:
  - Requires specialized payment domain expertise
  - High reusability (recurring feature)
  - Complex compliance and security requirements
**Tools**: Standard tools + WebFetch for Stripe API (NO MCP - PAID service)

### Example 6: One-Time Script (Direct Handling)
**User**: "Write a script to migrate data from old format to new"
**Decision**: → Handle directly
**Reason**: One-time migration task, no need for permanent agent

### Example 7: Complex ML System (Create New Agent)
**User**: "Set up end-to-end ML inference pipeline with monitoring"
**Decision**: → Create ml-inference-specialist via subagent-factory
**Reason**:
  - Deep ML expertise required
  - Complex multi-step orchestration
  - Benefits from specialized tools
  - Will be maintained long-term

## Quality Assurance

After delegation:
1. Monitor subagent progress
2. Validate outputs meet requirements
3. Coordinate follow-up agents if needed (review, documentation)
4. Report completion status with summary

## Continuous Improvement

The subagent-factory maintains a registry of created subagents for future reuse:
- Successful custom subagents are saved as templates
- Performance metrics guide future delegations
- User feedback improves matching algorithms

---

## Key Principles

1. **Efficiency First**: Handle simple tasks directly without unnecessary delegation
2. **Expertise When Needed**: Delegate to specialists for domain-specific work
3. **Strategic Agent Creation**: Only create new agents for complex, reusable capabilities
4. **Cost-Benefit Analysis**: Creating an agent has overhead - justify it with long-term value
5. **Progressive Enhancement**: Start simple, add specialists as complexity grows

*This command ensures optimal task handling: direct execution for simple tasks, delegation to existing specialists for known domains, and strategic creation of new agents only for complex, reusable capabilities.*