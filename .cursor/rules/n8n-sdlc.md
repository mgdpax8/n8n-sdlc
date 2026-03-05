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

- **PROD** workflows keep their original name as-is (e.g., `Support Agent`, `List Invoices`)
- **DEV** workflows prepend the dev prefix: `DEV-Support Agent`, `DEV-List Invoices`
- No project name in workflow names. No `PROD-` prefix.
- The dev prefix comes from `n8n-sdlc/config/project.json` `naming.devPrefix` (default: `DEV-`)

**Examples:**

- PROD: `Support Agent`, DEV: `DEV-Support Agent`
- PROD: `List Invoices`, DEV: `DEV-List Invoices`
- PROD: `Billing Agent`, DEV: `DEV-Billing Agent`

### Local File Names

Workflow JSON files are saved to the folder specified by `localPath` in `id-mappings.json`:

- `agents/DEV-Support Agent.json`
- `agents/Support Agent.json`
- `tools/DEV-List Invoices.json`

### id-mappings.json Keys

Workflow keys in `id-mappings.json` use the **PROD name** (the real name):

```json
{
  "workflows": {
    "Support Agent": { "type": "agent", "localPath": "agents/", ... },
    "List Invoices": { "type": "tool", "localPath": "tools/", ... }
  }
}
```

## Project Configuration Requirements

Before performing ANY n8n operation, verify:

1. `n8n-sdlc/config/project.json` EXISTS and contains:
   - `n8nProjectId` - non-empty string (from workflow URL: projectId=...); locks MCP to this project only
   - `naming.devPrefix` - typically "DEV-"

2. `n8n-sdlc/config/id-mappings.json` EXISTS (for push/promote operations)

If these files don't exist, run the **Getting Started** or **Import Project** skill first.

## Reserve and Claim Pattern

Because MCP cannot create workflows in the correct folder:

### Automated Path (Slot Creator configured)

1. **AI calls the Slot Creator webhook** to bulk-create empty workflows and transfer them to the project folder
2. **AI auto-assigns slots** (empty slots are fungible)
3. **AI claims the slots** by updating `n8n-sdlc/config/id-mappings.json`
4. **AI updates the workflows** via MCP with actual content

The Slot Creator is configured via `slotCreator.webhookUrl` in `project.json`. See `n8n-sdlc/helpers/README.md`.

### Manual Path (No Slot Creator)

1. **User creates empty workflows** manually in n8n UI within the project folder
2. **AI pulls these workflows** to discover their IDs
3. **AI auto-assigns slots** and confirms the mapping with the user
4. **AI claims the slots** by updating `n8n-sdlc/config/id-mappings.json`
5. **AI updates the workflows** via MCP with actual content

Both paths are the ONLY way to get workflows into the correct n8n folder.

## Project Scoping (MCP Lock to One Project)

When calling `n8n_list_workflows`, **always** pass `projectId` from `n8n-sdlc/config/project.json` (`n8nProjectId`). Never list all workflows without this filter.

Before any `n8n_update_full_workflow`, `n8n_update_partial_workflow`, or **push** to an n8n workflow by ID: get the workflow once via `n8n_get_workflow` (mode: "full"); verify `data.shared[0].projectId` equals `n8n-sdlc/config/project.json`'s `n8nProjectId`. If it does not match, refuse the operation and tell the user the workflow is not in the locked project.

## External Dependencies

When a workflow references another workflow (via `workflowId`) that belongs to a **different** n8n project:

- **Never pull, modify, or manage** that workflow
- Record it in `id-mappings.json` under `externalDependencies`
- During promotion, leave external `workflowId` references **untouched** (same ID serves both DEV and PROD)
- Inform the user about external dependencies during import and promotion

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

1. Verify `n8n-sdlc/config/project.json` exists
2. Verify `n8n-sdlc/config/id-mappings.json` exists
3. Verify workflow is registered in id-mappings.json
4. Verify target workflow ID exists and is not null

### Before Push to PROD

In addition to standard checks:

1. Detect environment from workflow name (see Environment Detection below)
2. If PROD: Display warning and require explicit "confirm" from user
3. Save backup of current prod state locally before overwriting

**Example confirmation prompt:**

```
PRODUCTION UPDATE WARNING

You are about to update PRODUCTION workflow:
  Name: Support Agent
  ID: xyz789ProdId

This will affect live systems. Type "confirm" to proceed.
```

### Before Promote Operation

1. All standard push checks
2. Verify prod slot exists in id-mappings (status != "needs-slot")
3. Check ALL in-project `workflowId` references have prod mappings
4. External dependency references are left as-is (no mapping needed)
5. Check credential mappings if workflow uses environment-specific credentials
6. If any in-project reference is unmapped: STOP and tell user to reserve more slots

## ID Transformation During Promotion

When promoting from dev to prod, transform:

1. **Workflow name**: Strip the dev prefix (`DEV-Support Agent` -> `Support Agent`)

2. **workflowId references** (in-project only):

   ```json
   "workflowId": {
     "value": "{dev-workflow-id}"  // -> "{prod-workflow-id}"
   }
   ```

   External dependency references are left untouched.

3. **Credential IDs** (only if mapped in project.json):

   ```json
   "credentials": {
     "type": {
       "id": "{dev-cred-id}"  // -> "{prod-cred-id}"
     }
   }
   ```

## Reverse Transformation (Seed DEV from PROD)

When seeding a DEV copy from an existing PROD workflow:

1. **Workflow name**: Prepend the dev prefix (`Support Agent` -> `DEV-Support Agent`)
2. **workflowId references** (in-project only): PROD IDs -> DEV IDs
3. **Credential IDs**: PROD -> DEV (if mapped)
4. External dependency references are left untouched.

## Environment Detection

Determine environment from workflow name:

| Name Pattern | Environment | Safety Level |
|--------------|-------------|--------------|
| Starts with `DEV-` | Development | Standard (no confirmation needed) |
| Does NOT start with `DEV-` | Production | High (requires explicit confirmation) |

## File Resolution (localPath + Self-Healing)

Each workflow's `localPath` in `id-mappings.json` specifies the folder where its JSON files live. The file name is the workflow name + `.json`.

To resolve a file: `{localPath}{workflow name}.json` (e.g., `agents/DEV-Support Agent.json`).

**Self-healing:** If a file is not found at the expected `localPath`:

1. Search the workspace by filename
2. If found elsewhere: ask user if they want to update the mapping
3. If multiple matches: list them and ask which is correct
4. If not found anywhere: suggest pulling from n8n

## Forbidden Actions

1. NEVER push to a PROD workflow without explicit user confirmation
2. NEVER create workflows via MCP (they go to wrong folder)
3. NEVER promote if any in-project workflowId reference lacks a prod mapping
4. NEVER delete or overwrite id-mappings.json without backup
5. NEVER modify a workflow name in a way that changes its environment
6. NEVER pull, modify, or manage workflows outside the locked project

## Audit Trail Requirements

When performing operations, update `id-mappings.json` audit fields:

```json
{
  "audit": {
    "lastPromoted": "2026-02-05T14:30:00Z",
    "promotionCount": 3,
    "lastLocalPull": "2026-02-05T10:00:00Z"
  }
}
```

## Error Recovery

1. **Atomic operations**: Complete fully or not at all
2. **Backup before prod changes**: Save current state locally
3. **Clear error messages**: Explain what went wrong and how to fix it
4. **No partial states**: If promotion fails mid-way, do not leave half-transformed workflow

## Git Sync (Project Repo)

Every SDLC operation that changes local files automatically commits and pushes to the project's git repo (not the SDLC framework repo). Controlled by `n8n-sdlc/config/project.json` `git` settings.

### Branch Model

```
main   -- mirrors PROD state; only updated via PR after promotion
dev    -- active development; all push/pull/seed operations commit here
```

Day-to-day work happens on `dev`. When a workflow is promoted DEV->PROD, the user is offered a PR from `dev` to `main`.

### Commit Message Format

```
[push] DEV-Support Agent
[pull] Support Agent
[promote] Support Agent (v3)
[seed] DEV-Support Agent from PROD
[import] Initial import: 5 workflows discovered
[reserve] Claimed 3 DEV slots
```

### What Gets Committed

- Workflow JSON files (agents/, tools/)
- `n8n-sdlc/config/id-mappings.json`
- `n8n-sdlc/config/project.json`

### What NEVER Gets Committed

- `n8n-sdlc/config/secrets.json`
- `.env` files
- API keys or credentials

### Disabling Git Sync

Set `git.enabled` to `false` in `n8n-sdlc/config/project.json` to skip all git operations. If the workspace is not a git repo, git sync is skipped silently.

## File Organization

Default flat layout:

```
project/
├── .cursor/
│   ├── rules/           # These rules
│   └── skills/          # Automation skills
├── n8n-sdlc/
│   ├── config/          # Configuration files
│   │   ├── project.json
│   │   └── id-mappings.json
│   └── docs/            # Documentation
├── agents/              # Agent workflows (AI-powered)
└── tools/               # Tool workflows (plain automation)
```

Categorized layout (if chosen during setup wizard):

```
project/
├── .cursor/
├── n8n-sdlc/
│   ├── config/
│   └── docs/
├── agents/              # Top-level agents (entry points)
│   └── agents/          # Sub-agents (agents called by other agents)
└── tools/               # Shared tools or all tools (depending on strategy)
    └── {parent}/        # Grouped dedicated tools (if grouped strategy)
```

## Quick Reference

| Operation | Confirmation Required | Config Required | Git Sync |
|-----------|----------------------|-----------------|----------|
| Pull any workflow | No | project.json | Auto commit+push |
| Push to DEV | No | project.json, id-mappings.json | Auto commit+push |
| Push to PROD | Yes - explicit "confirm" | project.json, id-mappings.json | Auto commit+push |
| Promote DEV->PROD | Yes - show changes + "confirm" | Both configs + all in-project refs mapped | Auto commit+push + offer PR |
| Seed DEV from PROD | No | project.json, id-mappings.json | Auto commit+push |
| Import project | User guides discovery | project.json | Auto commit+push (initial) |
| Reserve slots (automated) | API key + confirm mapping | project.json, slotCreator | Auto commit+push |
| Reserve slots (manual) | User creates slots + confirm mapping | project.json | Auto commit+push |
| Get started (wizard) | User answers questions | None (creates them) | Sets up git config |
