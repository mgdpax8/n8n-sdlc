# Skill: Push Workflow

Push a local workflow to n8n (update existing workflow).

## When to Use

- Syncing local changes to n8n
- After making edits to workflow JSON locally
- User says "push workflow", "update n8n", "sync to n8n", "deploy workflow"

## Critical Safety Rules

1. **NEVER create new workflows** - MCP puts them in wrong folder
2. **Workflow must already exist** in n8n with ID in mappings
3. **PROD updates require explicit confirmation**
4. **Backup PROD before overwriting**

## Prerequisites

- `config/project.json` must exist
- `config/id-mappings.json` must exist
- Local workflow file must exist
- Target workflow must exist in n8n (reserved slot)
- n8n MCP server must be available

## Steps

### Step 1: Identify the Workflow

Accept workflow by:
- **Local file path**: `agents/DEV-BillingBot-InvoiceAgent.json`
- **Logical name + environment**: "Invoice Agent" (dev or prod)
- **Full workflow name**: "DEV-BillingBot-InvoiceAgent"

### Step 2: Load and Parse Local Workflow

```
1. Read the local JSON file
2. Parse the workflow name
3. Detect environment from prefix (DEV- or PROD-)
```

### Step 3: Run Pre-Flight Validation

Call the `validate-workflow` skill checks:

1. ✅ `config/project.json` exists and is valid
2. ✅ `config/id-mappings.json` exists
3. ✅ Workflow name matches project naming convention
4. ✅ Workflow ID exists in id-mappings.json
5. ✅ ID is not null (slot has been reserved)

**If validation fails, STOP and report errors.**

### Step 4: Detect Environment and Apply Safety

Parse environment from workflow name:

```javascript
if (workflowName.startsWith("DEV-")) {
  environment = "dev"
  requiresConfirmation = false
} else if (workflowName.startsWith("PROD-")) {
  environment = "prod"
  requiresConfirmation = true
} else {
  // Unknown environment - block operation
  ERROR("Workflow name must start with DEV- or PROD-")
}
```

### Step 5: PROD Safety Checks (If Pushing to PROD)

If `environment === "prod"`:

```
⚠️ PRODUCTION UPDATE WARNING ⚠️

You are about to update a PRODUCTION workflow:

  Workflow: PROD-BillingBot-InvoiceAgent
  Target ID: xyz789ProdId
  
This will affect LIVE systems.

Before proceeding, I will:
1. Pull current PROD version as backup
2. Push your local version to n8n

Type "confirm" to proceed, or anything else to cancel.
```

**Wait for explicit "confirm" response.**

If user does NOT type "confirm":
```
Operation cancelled. No changes were made to production.
```

### Step 6: Backup Current State (PROD Only)

Before overwriting PROD:

```
1. Pull current workflow from n8n via MCP
2. Save to: agents/PROD-BillingBot-InvoiceAgent.backup.{timestamp}.json
3. Log backup location
```

### Step 7: Resolve Target Workflow ID

```
1. Read id-mappings.json
2. Find workflow by logical name (extract from full name)
3. Get the appropriate ID (dev or prod based on environment)
```

**Logical name extraction:**
```
Full name: "DEV-BillingBot-InvoiceAgent"
Project name (from config): "BillingBot"
Logical name: "InvoiceAgent"
```

### Step 8: Prepare Workflow for Push

Ensure the workflow JSON has the correct ID:

```json
{
  "name": "DEV-BillingBot-InvoiceAgent",
  "id": "{TARGET_ID}",  // Must match id-mappings entry
  ...
}
```

**Important:** The `id` field in the JSON should match the target workflow ID in n8n.

### Step 9: Push to n8n via MCP

Use n8n MCP to update the workflow:

```
MCP Command: update_workflow
Parameters:
  - workflow_id: {target ID}
  - workflow_data: {local JSON content}
```

### Step 10: Verify Push Success

After MCP call:

```
1. Check MCP response for errors
2. Optionally pull workflow back to verify content matches
3. Report success or failure
```

### Step 11: Update Audit Trail

Update `config/id-mappings.json`:

```json
{
  "InvoiceAgent": {
    "dev": {
      "id": "abc123",
      "status": "active"  // Update from "reserved" if first push
    },
    "audit": {
      "lastPush": "2026-02-05T16:00:00Z",
      "lastPushEnvironment": "dev"
    }
  }
}
```

### Step 12: Confirm Completion

**For DEV:**
```
Successfully pushed workflow to n8n!

Workflow: DEV-BillingBot-InvoiceAgent
Target ID: abc123
Environment: Development

The n8n workflow has been updated with your local changes.
```

**For PROD:**
```
Successfully pushed workflow to PRODUCTION!

Workflow: PROD-BillingBot-InvoiceAgent
Target ID: xyz789
Environment: Production

Backup saved: agents/PROD-BillingBot-InvoiceAgent.backup.2026-02-05T16-00-00.json

⚠️ Please verify the workflow is working correctly in n8n.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Workflow ID not found | Run reserve-workflows skill first |
| ID is null in mappings | Slot not reserved; reserve it first |
| Validation failed | Fix validation errors and retry |
| MCP update failed | Check MCP logs; verify n8n access |
| User didn't confirm PROD | Operation cancelled; no changes made |

## Validation Errors and Fixes

| Validation Error | Fix |
|-----------------|-----|
| project.json missing | Run getting-started skill |
| id-mappings.json missing | Run getting-started skill |
| Name doesn't match pattern | Rename workflow to follow convention |
| ID not in mappings | Run reserve-workflows skill |

## MCP Commands Used

- `update_workflow` - Push workflow content to n8n
- `get_workflow` - Pull current state for backup (PROD only)

## What Push Does NOT Do

- ❌ Create new workflows (use reserve-workflows instead)
- ❌ Transform IDs (use promote-workflow for that)
- ❌ Push without validation
- ❌ Push to PROD without confirmation

## Related Skills

- `validate-workflow.md` - Called automatically before push
- `pull-workflow.md` - Fetch latest from n8n
- `promote-workflow.md` - Push DEV to PROD with ID transformation
- `reserve-workflows.md` - Reserve slots before first push
