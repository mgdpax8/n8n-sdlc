# n8n SDLC Rules and Conventions

This document defines the rules, conventions, and safety requirements for working with n8n workflows in this project.

## Critical Constraint: MCP Folder Behavior

**The n8n MCP server creates new workflows in the "Personal" folder, not in project folders.**

This means:
- You CANNOT directly create workflows in the correct project folder via MCP
- You MUST use the "Reserve and Claim" pattern (see below)
- MCP is used only for UPDATING existing workflows, never for creating new ones

## Naming Conventions

### Workflow Names

All workflows MUST follow this naming pattern:

```
{ENV}-{ProjectName}-{WorkflowName}
```

Where:
- `{ENV}` is either `DEV` or `PROD`
- `{ProjectName}` is from `config/project.json`
- `{WorkflowName}` is a descriptive name (PascalCase, no spaces)

**Examples:**
- `DEV-BillingBot-InvoiceAgent`
- `PROD-BillingBot-InvoiceAgent`
- `DEV-BillingBot-ListInvoices`
- `PROD-BillingBot-ListInvoices`

### Local File Names

Workflow JSON files saved locally should match the workflow name:
- `agents/DEV-BillingBot-InvoiceAgent.json`
- `tools/DEV-BillingBot-ListInvoices.json`

## Project Configuration Requirements

Before performing ANY n8n operation, verify:

1. `config/project.json` EXISTS and contains:
   - `projectName` - non-empty string
   - `n8nFolder` - non-empty string
   - `n8nProjectId` - non-empty string (from workflow URL: projectId=...); locks MCP to this project only
   - `naming.devPrefix` - typically "DEV-"
   - `naming.prodPrefix` - typically "PROD-"

2. `config/id-mappings.json` EXISTS (for push/promote operations)

If these files don't exist, run the **Getting Started** skill first.

## Reserve and Claim Pattern

Because MCP cannot create workflows in the correct folder:

1. **User creates empty workflows** manually in n8n UI within the project folder
2. **AI pulls these workflows** to discover their IDs
3. **AI claims the slots** by updating `config/id-mappings.json`
4. **AI updates the workflows** via MCP with actual content

This is the ONLY way to get workflows into the correct n8n folder.

## Project Scoping (MCP Lock to One Project)

When calling `n8n_list_workflows`, **always** pass `projectId` from `config/project.json` (`n8nProjectId`). Never list all workflows without this filter.

Before any `n8n_update_full_workflow`, `n8n_update_partial_workflow`, or **push** to an n8n workflow by ID: get the workflow once via `n8n_get_workflow` (mode: "full"); verify `data.shared[0].projectId` equals `config/project.json`'s `n8nProjectId`. If it does not match, refuse the operation and tell the user the workflow is not in the locked project.

## MCP Update Behavior (Tested 2026-02-23)

- **Active (published) workflows:** `n8n_update_full_workflow` and `n8n_update_partial_workflow` publish changes **immediately** -- they go live the instant the call completes. This differs from the n8n UI canvas, which autosaves without publishing.
- **Inactive (unpublished) workflows:** MCP updates save changes only (like autosave). No publish occurs.
- **MCP cannot activate or deactivate workflows.** First-time PROD promotions (inactive slot) require manual activation in n8n UI.

## Available MCP Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `n8n_list_workflows` | List workflows (metadata only) | `projectId`, `limit`, `active`, `tags` |
| `n8n_get_workflow` | Get workflow by ID | `id`, `mode` (full/details/structure/minimal) |
| `n8n_update_full_workflow` | Full workflow replacement | `id`, `name`, `nodes`, `connections`, `settings` |
| `n8n_update_partial_workflow` | Incremental updates (rename, add/remove node) | `id`, `operations[]` |
| `n8n_validate_workflow` | Validate workflow in n8n | `id`, `options.profile` (strict recommended) |
| `n8n_workflow_versions` | Version history and rollback | `mode`, `workflowId` |
| `n8n_create_workflow` | Create workflow (NEVER USE -- goes to Personal) | `name`, `nodes`, `connections` |

## Safety Checks - ALWAYS Perform

### Before ANY Push Operation

1. ✅ Verify `config/project.json` exists
2. ✅ Verify `config/id-mappings.json` exists
3. ✅ Verify workflow name matches project naming convention
4. ✅ Verify target workflow ID exists in id-mappings.json

### Before Push to PROD

In addition to standard checks:

1. ✅ Detect environment from workflow name prefix
2. ⚠️ If PROD: Display warning and require explicit "confirm" from user
3. ✅ Save backup of current prod state locally before overwriting

**Example confirmation prompt:**
```
⚠️ PRODUCTION UPDATE WARNING

You are about to update PRODUCTION workflow:
  Name: PROD-BillingBot-InvoiceAgent
  ID: xyz789ProdId

This will affect live systems. Type "confirm" to proceed.
```

### Before Promote Operation

1. ✅ All standard push checks
2. ✅ Verify prod slot exists in id-mappings (status != "needs-slot")
3. ✅ Check ALL `workflowId` references in the workflow have prod mappings
4. ✅ Check credential mappings if workflow uses environment-specific credentials
5. ⚠️ If any reference is unmapped: STOP and tell user to reserve more slots

## ID Transformation During Promotion

When promoting from dev to prod, transform:

1. **Workflow name**: `DEV-{Project}-{Name}` → `PROD-{Project}-{Name}`

2. **workflowId references** (in tool nodes):
   ```json
   "workflowId": {
     "value": "{dev-workflow-id}"  // → "{prod-workflow-id}"
   }
   ```

3. **Credential IDs** (only if mapped in project.json):
   ```json
   "credentials": {
     "type": {
       "id": "{dev-cred-id}"  // → "{prod-cred-id}"
     }
   }
   ```

## Environment Detection

Determine environment from workflow name prefix:

| Prefix | Environment | Safety Level |
|--------|-------------|--------------|
| `DEV-` | Development | Standard (no confirmation needed) |
| `PROD-` | Production | High (requires explicit confirmation) |
| Other | Unknown | Block operation, ask user |

## Forbidden Actions

1. ❌ NEVER push to a PROD workflow without explicit user confirmation
2. ❌ NEVER create workflows via MCP (they go to wrong folder)
3. ❌ NEVER promote if any workflowId reference lacks a prod mapping
4. ❌ NEVER delete or overwrite id-mappings.json without backup
5. ❌ NEVER modify a workflow name in a way that changes its environment

## Audit Trail Requirements

When performing operations, update `id-mappings.json` audit fields:

```json
{
  "audit": {
    "lastPromoted": "2026-02-05T14:30:00Z",  // When promoted
    "promotionCount": 3,                      // How many times
    "lastLocalPull": "2026-02-05T10:00:00Z"  // Last pulled from n8n
  }
}
```

## Error Recovery

1. **Atomic operations**: Complete fully or not at all
2. **Backup before prod changes**: Save current state locally
3. **Clear error messages**: Explain what went wrong and how to fix it
4. **No partial states**: If promotion fails mid-way, do not leave half-transformed workflow

## File Organization

```
project/
├── agents/           # Agent workflows (orchestrators)
│   └── DEV-*.json
├── tools/            # Tool workflows (called by agents)
│   └── DEV-*.json
├── docs/             # Documentation
├── config/           # Configuration files
│   ├── project.json
│   └── id-mappings.json
└── .cursor/
    ├── rules/        # These rules
    └── skills/       # Automation skills
```

## Quick Reference

| Operation | Confirmation Required | Config Required |
|-----------|----------------------|-----------------|
| Pull any workflow | No | project.json |
| Push to DEV | No | project.json, id-mappings.json |
| Push to PROD | Yes - explicit "confirm" | project.json, id-mappings.json |
| Promote DEV→PROD | Yes - show changes + "confirm" | Both configs + all refs mapped |
| Reserve slots | User selects from list | project.json |
| Getting started | User provides info | None (creates them) |
