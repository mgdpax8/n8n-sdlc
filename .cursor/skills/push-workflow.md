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
- **Local file path**: `agents/DEV-Support Agent.json`
- **Logical name + environment**: "Support Agent" (dev or prod)
- **Full workflow name**: "DEV-Support Agent" (dev) or "Support Agent" (prod)

### Step 2: Load and Parse Local Workflow

```
1. Resolve local file path (see Step 2.5)
2. Read the local JSON file
3. Parse the workflow name from the file
4. Detect environment from prefix (devPrefix from project.json = dev; otherwise prod)
```

### Step 2.5: Resolve Local File Path

Use `localPath` from id-mappings.json for file resolution:

```
1. Get logical name (workflow name without dev prefix, e.g., "Support Agent")
2. Look up workflow in id-mappings.json workflows
3. Get localPath from the mapping (e.g., "agents/", "tools/")
4. Primary path = {localPath}{workflow name}.json
   Example: agents/DEV-Support Agent.json or tools/List Invoices.json
5. If file not found at primary path: SELF-HEAL
   - Search workspace for filename (e.g., "DEV-Support Agent.json")
   - If found, update localPath in id-mappings.json to match actual location
   - Proceed with resolved path
6. If still not found: ERROR - file does not exist
```

### Step 3: Run Pre-Flight Validation

Call the `validate-workflow` skill checks:

1. ✅ `config/project.json` exists and is valid
2. ✅ `config/id-mappings.json` exists
3. ✅ Workflow name matches project naming convention
4. ✅ Workflow ID exists in id-mappings.json
5. ✅ ID is not null (slot has been reserved)

**If validation fails, STOP and report errors.**

### Step 3.5: Drift Detection (Version Check)

Before pushing, check if the remote workflow has been modified since last pull:

```
1. Call n8n_get_workflow(id: targetId, mode: "minimal") to get current remote versionId
2. Compare against audit.lastVersionId in id-mappings.json (saved during last pull/push)
3. If they differ: someone else has modified the workflow in n8n since our last sync
```

**If drift detected:**
```
⚠️ REMOTE DRIFT DETECTED

The workflow in n8n has been modified since your last pull/push.

  Local versionId:  {lastVersionId from id-mappings}
  Remote versionId: {current versionId from n8n}

Someone may have edited this workflow in the n8n UI.
Pushing now would overwrite their changes.

Options:
1. Pull the latest version first (recommended)
2. Push anyway (overwrites remote changes)
3. Cancel

What would you like to do?
```

**If no lastVersionId in audit:** Skip this check (first push, no baseline to compare against).

After a successful push, always update `audit.lastVersionId` in id-mappings.json with the new versionId from the push response or a subsequent get.

### Step 4: Detect Environment and Apply Safety

Parse environment from workflow name using `devPrefix` from `config/project.json`:

```javascript
devPrefix = project.json.naming.devPrefix  // e.g., "DEV-"
if (workflowName.startsWith(devPrefix)) {
  environment = "dev"
  requiresConfirmation = false
} else {
  // Everything else = prod (no PROD- prefix; prod name is the real name)
  environment = "prod"
  requiresConfirmation = true
}
```

No "unknown environment" blocking. DEV = no confirmation; PROD = requires confirmation.

### Step 5: PROD Safety Checks (If Pushing to PROD)

If `environment === "prod"`:

First, check if the target PROD workflow is active by calling `n8n_get_workflow` (mode: "minimal") and reading the `active` field.

**If PROD workflow is ACTIVE:**
```
⚠️ PRODUCTION UPDATE WARNING ⚠️

You are about to update a PRODUCTION workflow:

  Workflow: Support Agent
  Target ID: xyz789ProdId
  Status: ACTIVE (published)
  
⚠️ This update will PUBLISH IMMEDIATELY -- changes go live instantly.

Before proceeding, I will:
1. Pull current PROD version as backup
2. Push your local version to n8n (goes live immediately)

Type "confirm" to proceed, or anything else to cancel.
```

**If PROD workflow is INACTIVE:**
```
⚠️ PRODUCTION UPDATE WARNING ⚠️

You are about to update a PRODUCTION workflow:

  Workflow: Support Agent
  Target ID: xyz789ProdId
  Status: INACTIVE (not published)
  
This will save the workflow but NOT publish it.
You will need to activate/publish manually in n8n UI.

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
2. Save to: {localPath}{workflow name}.backup.{timestamp}.json
   Example: agents/Support Agent.backup.2026-02-05T16-00-00.json
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
Full name: "DEV-Support Agent"
devPrefix (from project.json): "DEV-"
Logical name: "Support Agent"  (strip devPrefix; this is the id-mappings key)

id-mappings.json keys use the PROD name (real name), e.g.:
  "Support Agent": { ... }
  "List Invoices": { ... }
```

### Step 8: Prepare Workflow for Push

Ensure the workflow JSON has the correct ID:

```json
{
  "name": "DEV-Support Agent",
  "id": "{TARGET_ID}",  // Must match id-mappings entry
  ...
}
```

**Important:** The `id` field in the JSON should match the target workflow ID in n8n.

### Step 9: Push to n8n via MCP

Use n8n MCP to update the workflow:

```
MCP Tool: n8n_update_full_workflow
Parameters:
  - id: {target ID}
  - name: {workflow name}
  - nodes: {nodes array from local JSON}
  - connections: {connections object from local JSON}
  - settings: {settings object from local JSON}

Note: n8n_update_full_workflow requires the complete nodes[] and connections{}.
If the target workflow is ACTIVE, this update publishes immediately (goes live).
If the target workflow is INACTIVE, this update saves only (like autosave).
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
  "Support Agent": {
    "dev": {
      "id": "abc123",
      "status": "active"  // Update from "reserved" if first push
    },
    "audit": {
      "lastPush": "2026-02-05T16:00:00Z",
      "lastPushEnvironment": "dev",
      "lastVersionId": "{versionId from push response}"
    }
  }
}
```

### Step 12: Confirm Completion

**For DEV:**
```
Successfully pushed workflow to n8n!

Workflow: DEV-Support Agent
Target ID: abc123
Environment: Development

The n8n workflow has been updated with your local changes.
```

**For PROD:**
```
Successfully pushed workflow to PRODUCTION!

Workflow: Support Agent
Target ID: xyz789
Environment: Production

Backup saved: agents/Support Agent.backup.2026-02-05T16-00-00.json

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
| File not found at localPath | Self-heal: search workspace by filename; if found, update localPath |

## Validation Errors and Fixes

| Validation Error | Fix |
|-----------------|-----|
| project.json missing | Run getting-started skill |
| id-mappings.json missing | Run getting-started skill |
| Name doesn't match pattern | Rename workflow to follow convention |
| ID not in mappings | Run reserve-workflows skill |

## MCP Commands Used

- `n8n_update_full_workflow` - Push complete workflow content to n8n (requires id, nodes, connections)
- `n8n_get_workflow` - Pull current state for backup (PROD only; mode: "full")

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
