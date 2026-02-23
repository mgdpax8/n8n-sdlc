# Skill: Pull Workflow

Fetch a workflow from n8n and save it locally.

## When to Use

- Syncing latest version from n8n to local
- Creating local backup before making changes
- Importing an existing workflow into the project
- User says "pull workflow", "fetch workflow", "download workflow", "sync from n8n"

## Prerequisites

- `config/project.json` must exist
- n8n MCP server must be available
- Workflow must exist in n8n

## Steps

### Step 1: Identify the Workflow

The user may specify the workflow by:
- **Logical name** (PROD name): "Support Agent" — the id-mappings key
- **Full name**: "DEV-Support Agent" or "Support Agent"
- **n8n ID**: "YbM4pqxRD0AnOVhb"

**Naming convention:**
- Logical name = id-mappings key = PROD name (e.g., "Support Agent")
- Full DEV name = `{devPrefix}{logical name}` (e.g., "DEV-Support Agent")
- Full PROD name = logical name, no prefix (e.g., "Support Agent")
- `devPrefix` comes from `config/project.json` → `naming.devPrefix`

If the user gives a logical name, determine which environment:
```
Do you want to pull the DEV or PROD version of "Support Agent"?
```

### Step 2: Resolve the Workflow ID

**If logical name provided:**
```
1. Read config/id-mappings.json
2. Find the workflow entry by name (key = PROD name)
3. Get dev.id or prod.id based on environment
```

**If full name provided:**
```
1. Parse environment: DEV prefix present = dev, no prefix = prod
2. Strip devPrefix to get logical name (if DEV)
3. Look up in id-mappings.json by logical name
4. Get the corresponding ID
```

**If ID provided:**
```
Use the ID directly
```

### Step 3: Validate Configuration

Run the validation skill checks:
1. ✅ `config/project.json` exists
2. ✅ Workflow ID is valid (not null/empty)
3. ✅ If using id-mappings, entry exists

### Step 4: Pull from n8n via MCP

Use n8n MCP to fetch the workflow:

```
MCP Tool: n8n_get_workflow
Parameters:
  - id: {resolved workflow ID}
  - mode: "full"
```

After fetching, verify the workflow is in the locked project: `data.shared[0].projectId` must equal `config/project.json` n8nProjectId. If it does not match, refuse the pull and tell the user the workflow is not in the configured project.

### Step 5: Determine Local File Path

Use `localPath` from id-mappings.json — do not derive path from workflow type.

**File path formula:**
```
{localPath}{workflow name}.json
```

- DEV: `{localPath}{devPrefix}{logical name}.json` → e.g., `agents/DEV-Support Agent.json`
- PROD: `{localPath}{logical name}.json` → e.g., `agents/Support Agent.json`

**Self-healing:** If the expected file exists elsewhere (e.g., moved), search the workspace for `{workflow name}.json` or `DEV-{logical name}.json`. If found, use that path and optionally update id-mappings.json `localPath` to reflect the actual location.

### Step 6: Handle Existing Local File

If the local file already exists:

```
Local file already exists: agents/DEV-Support Agent.json

Options:
1. Overwrite (replace local with n8n version)
2. Backup and overwrite (save current as .backup before replacing)
3. Cancel

What would you like to do?
```

**If user chooses backup:**
```
1. Rename existing file to {name}.backup.json
2. Save new content to original path
```

### Step 7: Save Workflow Locally

Write the workflow JSON to the determined path:

```json
// Save to: agents/DEV-Support Agent.json
{
  "name": "DEV-Support Agent",
  "nodes": [...],
  ...
}
```

### Step 8: Update Audit Trail

Update `config/id-mappings.json` with pull timestamp and versionId (for drift detection):

```json
{
  "Support Agent": {
    "type": "agent",
    "localPath": "agents/",
    "dev": {
      "id": "abc123",
      "status": "active"
    },
    "prod": {
      "id": "xyz789",
      "status": "active"
    },
    "audit": {
      "lastLocalPull": "2026-02-05T15:30:00Z",  // ← Update this
      "lastVersionId": "784c01e4-082e-4c96-..."  // ← Save versionId from n8n response
    }
  }
}
```

### Step 9: Confirm Completion

```
Successfully pulled workflow from n8n!

Workflow: DEV-Support Agent
Source ID: YbM4pqxRD0AnOVhb
Saved to: agents/DEV-Support Agent.json

The local file now matches the n8n version.
```

## Pulling Multiple Workflows

If user wants to pull multiple workflows:

```
Which workflows would you like to pull?
1. All DEV workflows
2. All PROD workflows  
3. Specific workflow(s) - list them
4. All workflows in id-mappings.json
```

**For bulk pull:**
1. Iterate through id-mappings.json entries
2. Pull each workflow
3. Report summary at end

## Error Handling

| Error | Resolution |
|-------|------------|
| Workflow not found in n8n | Verify ID is correct; check if deleted |
| MCP connection failed | Check MCP server status; retry |
| ID not in mappings | Ask user for ID directly; optionally add to mappings |
| File write failed | Check disk space; verify path permissions |

## Validation Checks

1. ✅ project.json exists
2. ✅ Workflow ID resolves to non-null value
3. ✅ MCP is responsive
4. ✅ Workflow exists in n8n (MCP returns data)

## MCP Commands Used

- `n8n_get_workflow` - Fetch workflow by ID (mode: "full" for complete data including `shared[0].projectId`)
- `n8n_list_workflows` - List workflows; always pass `projectId` from config/project.json (n8nProjectId)

## Special Cases

### Pulling a Workflow Not in Mappings

If pulling a workflow that's not tracked:

```
This workflow is not in id-mappings.json.

Would you like to:
1. Add it to mappings (provide logical name)
2. Save it locally only (won't track in SDLC)
3. Cancel
```

### Pulling PROD for Backup

Before promotion, pull current PROD as backup:

```
Pulling Support Agent (PROD) as backup...
Saved to: agents/Support Agent.backup.json

This backup can be used to restore if promotion causes issues.
```

## Related Skills

- `push-workflow.md` - Push local changes back to n8n
- `promote-workflow.md` - Promote DEV to PROD
- `validate-workflow.md` - Validate before operations
