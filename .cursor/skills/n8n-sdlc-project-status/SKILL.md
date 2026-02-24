---
name: n8n-sdlc-project-status
description: Show an at-a-glance dashboard of all workflows, their sync status, and project health. Use when user says "project status", "show status", "dashboard", or "what needs work".
---

Show an at-a-glance dashboard of all workflows, their sync status, and project health.

## When to Use

- Getting an overview of the project state
- Checking which workflows need promotion
- Verifying all slots are reserved
- User says "project status", "show status", "dashboard", "what needs work"

## Prerequisites

- `n8n-sdlc/config/project.json` must exist
- `n8n-sdlc/config/id-mappings.json` must exist
- n8n MCP server should be available (for live checks)

## Naming Conventions

- **id-mappings keys** = PROD workflow name (e.g., "Support Agent", "List Invoices")
- **PROD display** = Workflow name as-is (e.g., "Support Agent")
- **DEV display** = "DEV-{name}" (e.g., "DEV-Support Agent")
- No project name in workflow names; no PROD- prefix

## Steps

### Step 1: Load Configuration

Read `n8n-sdlc/config/project.json` and `n8n-sdlc/config/id-mappings.json`.

### Step 2: List All Workflows from Registry

For each workflow in `id-mappings.json` workflows, gather:
- Logical name (PROD name = id-mappings key)
- Type (agent/tool)
- localPath
- DEV slot ID and status
- PROD slot ID and status
- Last promoted timestamp
- Last pull/push timestamps

### Step 3: Check Remote Status (if MCP available)

Call `n8n_list_workflows` with `projectId` to get current state of all workflows in n8n.

For each registered workflow, compare:
- Does the ID still exist in n8n?
- Is it active or inactive?
- What is the remote `updatedAt` vs our audit timestamps?

### Step 4: Build Status Report

```
═══════════════════════════════════════════════════════════════════
                PROJECT STATUS: {ProjectName}
═══════════════════════════════════════════════════════════════════

Project: {projectName}
n8n Project ID: {n8nProjectId}
Total Workflows: {count}

WORKFLOW STATUS:
───────────────────────────────────────────────────────────────────
┌────────────────────┬──────┬─────────────┬─────────────┬──────────┐
│ Workflow           │ Type │ DEV Status  │ PROD Status │ Promoted │
├────────────────────┼──────┼─────────────┼─────────────┼──────────┤
│ Support Agent      │ agent│ ✓ active    │ ✓ active    │ 3x       │
│ List Invoices      │ tool │ ✓ active    │ ✓ active    │ 2x       │
│ Get Totals         │ tool │ ✓ active    │ ⬜ reserved  │ never    │
│ New Feature        │ tool │ ✓ reserved  │ ❌ needs-slot│ never    │
└────────────────────┴──────┴─────────────┴─────────────┴──────────┘

DETAILED VIEW (with localPath):
───────────────────────────────────────────────────────────────────
┌────────────────────┬──────┬──────────────────┬─────────────┬─────────────┐
│ Workflow           │ Type │ localPath         │ DEV Status  │ PROD Status │
├────────────────────┼──────┼──────────────────┼─────────────┼─────────────┤
│ Support Agent      │ agent│ agents/           │ ✓ active    │ ✓ active    │
│ List Invoices      │ tool │ tools/            │ ✓ active    │ ✓ active    │
│ Get Totals         │ tool │ tools/            │ ✓ active    │ ⬜ reserved  │
│ New Feature        │ tool │ tools/            │ ✓ reserved  │ ❌ needs-slot│
└────────────────────┴──────┴──────────────────┴─────────────┴─────────────┘

EXTERNAL DEPENDENCIES:
───────────────────────────────────────────────────────────────────
External workflows referenced by in-project workflows (not managed by SDLC):
┌────────────────────────────┬──────────────────────┬─────────────────────┐
│ External Workflow          │ n8n ID               │ Referenced By       │
├────────────────────────────┼──────────────────────┼─────────────────────┤
│ Shared Lookup Tool         │ ext-workflow-id      │ Support Agent       │
│ Platform Auth Helper       │ auth-helper-id       │ Support Agent, ...  │
└────────────────────────────┴──────────────────────┴─────────────────────┘

SYNC STATUS (requires MCP):
───────────────────────────────────────────────────────────────────
┌──────────────────────┬──────────────┬──────────────┬───────────────┐
│ Workflow             │ Last Pull    │ Last Push    │ Remote Changed│
├──────────────────────┼──────────────┼──────────────┼───────────────┤
│ DEV-Support Agent    │ 2026-02-23   │ 2026-02-23   │ No            │
│ Support Agent        │ 2026-02-22   │ 2026-02-22   │ Yes ⚠️        │
│ DEV-List Invoices    │ 2026-02-20   │ 2026-02-21   │ No            │
└──────────────────────┴──────────────┴──────────────┴───────────────┘

ISSUES:
───────────────────────────────────────────────────────────────────
  ⚠️ Get Totals: PROD slot reserved but never promoted
  ❌ New Feature: Needs PROD slot -- run n8n-sdlc-reserve-workflows
  ⚠️ Support Agent PROD: Remote may have drifted -- run diff

ACTIONS AVAILABLE:
  - "import project" to initialize from existing n8n project
  - "seed dev" to populate DEV workflows from local files
  - "reserve workflows" to claim PROD slots for New Feature
  - "promote Get Totals" to deploy to production
  - "diff Support Agent prod" to check for remote drift
```

### Step 5: Summarize Key Metrics

```
Summary:
  Workflows tracked:     {total}
  Fully deployed:        {count with both DEV+PROD active}
  Needing PROD slots:    {count with needs-slot}
  Never promoted:        {count with reserved PROD but promotionCount=0}
  Potential drift:       {count where remote versionId != audit.lastVersionId}
  External deps:         {count from externalDependencies}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Run the get-started skill |
| id-mappings.json missing | Run the get-started skill |
| MCP not available | Show local status only (skip remote checks) |
| No workflows registered | Run n8n-sdlc-reserve-workflows to get started |

## MCP Commands Used

- `n8n_list_workflows` - Get current workflow states from n8n (pass `projectId`)
- `n8n_get_workflow` - Get detailed info for drift detection (mode: "minimal" for versionId)

## Related Skills

- `n8n-sdlc-reserve-workflows` - Fix "needs-slot" issues
- `n8n-sdlc-promote-workflow` - Deploy workflows shown as "never promoted"
- `n8n-sdlc-diff-workflow` - Investigate drift warnings
- `n8n-sdlc-validate-workflow` - Validate project configuration
