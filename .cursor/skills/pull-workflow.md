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
- **Logical name**: "Invoice Agent" (look up in id-mappings.json)
- **Full name**: "DEV-BillingBot-InvoiceAgent" 
- **n8n ID**: "YbM4pqxRD0AnOVhb"

If the user gives a logical name, determine which environment:
```
Do you want to pull the DEV or PROD version of "Invoice Agent"?
```

### Step 2: Resolve the Workflow ID

**If logical name provided:**
```
1. Read config/id-mappings.json
2. Find the workflow entry by name
3. Get the dev.id or prod.id based on environment
```

**If full name provided:**
```
1. Parse the environment prefix (DEV- or PROD-)
2. Look up in id-mappings.json
3. Get the corresponding ID
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
MCP Command: get_workflow
Parameters:
  - workflow_id: {resolved workflow ID}
```

After fetching, verify the workflow is in the locked project: `data.shared[0].projectId` must equal `config/project.json` n8nProjectId. If it does not match, refuse the pull and tell the user the workflow is not in the configured project.

### Step 5: Determine Local File Path

Based on workflow type and environment:

**Agent workflows:**
```
agents/{FULL-WORKFLOW-NAME}.json

Example: agents/DEV-BillingBot-InvoiceAgent.json
```

**Tool workflows:**
```
tools/{FULL-WORKFLOW-NAME}.json

Example: tools/DEV-BillingBot-ListInvoices.json
```

**How to determine type:**
- Check `type` field in id-mappings.json entry
- Or check if workflow contains AI agent nodes (`@n8n/n8n-nodes-langchain.agent`)
- Default to "tool" if unclear

### Step 6: Handle Existing Local File

If the local file already exists:

```
Local file already exists: agents/DEV-BillingBot-InvoiceAgent.json

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
// Save to: agents/DEV-BillingBot-InvoiceAgent.json
{
  "name": "DEV-BillingBot-InvoiceAgent",
  "nodes": [...],
  ...
}
```

### Step 8: Update Audit Trail

Update `config/id-mappings.json` with pull timestamp:

```json
{
  "InvoiceAgent": {
    "type": "agent",
    "dev": {
      "id": "abc123",
      "status": "active"
    },
    "audit": {
      "lastLocalPull": "2026-02-05T15:30:00Z"  // ← Update this
    }
  }
}
```

### Step 9: Confirm Completion

```
Successfully pulled workflow from n8n!

Workflow: DEV-BillingBot-InvoiceAgent
Source ID: YbM4pqxRD0AnOVhb
Saved to: agents/DEV-BillingBot-InvoiceAgent.json

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

- `get_workflow` - Fetch workflow by ID
- `list_workflows` - List workflows; always pass `projectId` from config/project.json (n8nProjectId)

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
Pulling PROD-BillingBot-InvoiceAgent as backup...
Saved to: agents/PROD-BillingBot-InvoiceAgent.backup.json

This backup can be used to restore if promotion causes issues.
```

## Related Skills

- `push-workflow.md` - Push local changes back to n8n
- `promote-workflow.md` - Promote DEV to PROD
- `validate-workflow.md` - Validate before operations
