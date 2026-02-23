# Skill: Project Status

Show an at-a-glance dashboard of all workflows, their sync status, and project health.

## When to Use

- Getting an overview of the project state
- Checking which workflows need promotion
- Verifying all slots are reserved
- User says "project status", "show status", "dashboard", "what needs work"

## Prerequisites

- `config/project.json` must exist
- `config/id-mappings.json` must exist
- n8n MCP server should be available (for live checks)

## Steps

### Step 1: Load Configuration

Read `config/project.json` and `config/id-mappings.json`.

### Step 2: List All Workflows from Registry

For each workflow in `id-mappings.json`, gather:
- Logical name
- Type (agent/tool)
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
n8n Project: {n8nProjectId}
Folder: {n8nFolder} (not verifiable via MCP)
Total Workflows: {count}

WORKFLOW STATUS:
───────────────────────────────────────────────────────────────────
┌──────────────────┬──────┬─────────────┬─────────────┬──────────┐
│ Workflow         │ Type │ DEV Status  │ PROD Status │ Promoted │
├──────────────────┼──────┼─────────────┼─────────────┼──────────┤
│ InvoiceAgent     │ agent│ ✓ active    │ ✓ active    │ 3x       │
│ ListInvoices     │ tool │ ✓ active    │ ✓ active    │ 2x       │
│ GetTotals        │ tool │ ✓ active    │ ⬜ reserved  │ never    │
│ NewFeature       │ tool │ ✓ reserved  │ ❌ needs-slot│ never    │
└──────────────────┴──────┴─────────────┴─────────────┴──────────┘

SYNC STATUS (requires MCP):
───────────────────────────────────────────────────────────────────
┌──────────────────┬──────────────┬──────────────┬───────────────┐
│ Workflow         │ Last Pull    │ Last Push    │ Remote Changed│
├──────────────────┼──────────────┼──────────────┼───────────────┤
│ InvoiceAgent DEV │ 2026-02-23   │ 2026-02-23   │ No            │
│ InvoiceAgent PROD│ 2026-02-22   │ 2026-02-22   │ Yes ⚠️        │
│ ListInvoices DEV │ 2026-02-20   │ 2026-02-21   │ No            │
└──────────────────┴──────────────┴──────────────┴───────────────┘

ISSUES:
───────────────────────────────────────────────────────────────────
  ⚠️ GetTotals: PROD slot reserved but never promoted
  ❌ NewFeature: Needs PROD slot -- run reserve-workflows
  ⚠️ InvoiceAgent PROD: Remote may have drifted -- run diff

ACTIONS AVAILABLE:
  - "reserve workflows" to claim PROD slots for NewFeature
  - "promote GetTotals" to deploy to production
  - "diff InvoiceAgent prod" to check for remote drift
```

### Step 5: Summarize Key Metrics

```
Summary:
  Workflows tracked:     {total}
  Fully deployed:        {count with both DEV+PROD active}
  Needing PROD slots:    {count with needs-slot}
  Never promoted:        {count with reserved PROD but promotionCount=0}
  Potential drift:       {count where remote versionId != audit.lastVersionId}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Run getting-started skill |
| id-mappings.json missing | Run getting-started skill |
| MCP not available | Show local status only (skip remote checks) |
| No workflows registered | Run reserve-workflows to get started |

## MCP Commands Used

- `n8n_list_workflows` - Get current workflow states from n8n (pass `projectId`)
- `n8n_get_workflow` - Get detailed info for drift detection (mode: "minimal" for versionId)

## Related Skills

- `reserve-workflows.md` - Fix "needs-slot" issues
- `promote-workflow.md` - Deploy workflows shown as "never promoted"
- `diff-workflow.md` - Investigate drift warnings
- `validate-workflow.md` - Validate project configuration
