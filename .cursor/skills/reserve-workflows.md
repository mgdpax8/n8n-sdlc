# Skill: Reserve Workflows

Reserve and claim workflow slots in n8n using the "Reserve and Claim" pattern.

## When to Use

- After running the "Getting Started" skill
- When you need new workflow slots for dev and/or prod
- User says "reserve workflows", "claim slots", "set up workflow IDs"

## Why This Pattern Exists

**The n8n MCP server creates new workflows in the "Personal" folder, not in project folders.**

To get workflows into the correct project folder, we must:
1. Have the user manually create empty workflows in n8n
2. Pull those workflows to get their IDs
3. Claim the IDs for specific dev/prod workflow purposes

## Prerequisites

- `config/project.json` must exist (run Getting Started first)
- `config/id-mappings.json` must exist
- User must have access to n8n UI

## Steps

### Step 1: Determine Slots Needed

Ask the user what workflows they need to create. For each workflow, they need:
- 1 DEV slot
- 1 PROD slot (if they plan to promote)

**Example question:**
```
What workflows do you need to create? 

For each workflow, you'll need TWO slots (one dev, one prod).

Please list the workflow names (these will be the production names, e.g., 'Support Agent', 'List Invoices'):
1. Support Agent
2. List Invoices
3. Get Invoice Totals
```

### Step 2: Calculate Total Slots

```
Total slots needed = Number of workflows × 2 (dev + prod)

Example: 3 workflows = 6 empty slots needed
```

### Step 3: Instruct User to Create Empty Workflows

Tell the user:

```
Please go to n8n and create {N} empty workflows:

1. Go to your n8n instance
2. Navigate to the "{n8nFolder}" folder (from project.json)
3. Create {N} new empty workflows
   - The names don't matter yet (you can call them "Slot 1", "Slot 2", etc.)
   - Just make sure they're in the correct folder!

When you're done, say "done" or "ready" and I'll pull them to get their IDs.
```

### Step 4: Wait for User Confirmation

Wait for user to confirm they've created the workflows.

### Step 5: Pull Workflows from n8n

Use the n8n MCP server to list/pull workflows:

```
Use n8n MCP: n8n_list_workflows with projectId from config/project.json (n8nProjectId).
Filter by: 
  - Empty or minimal content
  - Recently created (createdAt)
```

Always pass `projectId` from project.json so only workflows in the locked project are listed.

### Step 6: Identify New Empty Workflows

Present the list of potential empty workflows to the user:

```
I found these workflows that might be your new empty slots:

1. ID: abc123 | Name: "Slot 1" | Created: 2026-02-05
2. ID: def456 | Name: "Slot 2" | Created: 2026-02-05
3. ID: ghi789 | Name: "Slot 3" | Created: 2026-02-05
...

Please confirm these are the correct workflows you just created.
```

After resolving each workflow ID, call `n8n_get_workflow` (mode: "full"); if `data.shared[0].projectId` does not match `config/project.json` n8nProjectId, exclude that workflow from the list and do not allow claim (workflow is not in the locked project). Use `nodeCount` from the list response to identify empty slots (nodeCount of 0 or 1 = empty/minimal).

### Step 7: Claim Slots for Specific Workflows

For each workflow the user wants to create, ask them to assign slots:

```
Now let's assign these slots to your workflows.

For each workflow, I need a DEV slot and a PROD slot:

Workflow: Support Agent
  - DEV slot: [User selects from list, e.g., "1"]
  - PROD slot: [User selects from list, e.g., "2"]

Workflow: List Invoices
  - DEV slot: [User selects, e.g., "3"]
  - PROD slot: [User selects, e.g., "4"]
```

### Step 8: Update id-mappings.json

Add entries for each claimed workflow. Include `localPath`:
- Default to `"agents/"` for AI workflows (type: agent)
- Default to `"tools/"` for others (type: tool)
- If the project has `folderStrategy.mode: "categorized"`, use the appropriate path for that strategy (e.g., nested paths)

Read `config/project.json` to get `naming.devPrefix` and `folderStrategy` (if present).

```json
{
  "workflows": {
    "Support Agent": {
      "type": "agent",
      "localPath": "agents/",
      "dev": {
        "id": "abc123",
        "status": "reserved"
      },
      "prod": {
        "id": "def456",
        "status": "reserved"
      }
    },
    "List Invoices": {
      "type": "tool",
      "localPath": "tools/",
      "dev": {
        "id": "ghi789",
        "status": "reserved"
      },
      "prod": {
        "id": "jkl012",
        "status": "reserved"
      }
    }
  }
}
```

### Step 9: Rename Workflows in n8n (Optional but Recommended)

Use MCP to update workflow names:

- **DEV slots only**: Rename to `"{devPrefix}{WorkflowName}"` (e.g., `"DEV-Support Agent"`). Get `devPrefix` from `config/project.json` → `naming.devPrefix` (default `"DEV-"`).
- **PROD slots**: Keep whatever name the user gave them in n8n. If the user named a slot "Slot 2" but it's claimed as "Support Agent", optionally rename it to "Support Agent" so it matches the logical name.

**Example MCP operation:**
```
Update workflow abc123 (DEV slot):
  - name: "DEV-Support Agent"
  
Update workflow def456 (PROD slot):
  - name: "Support Agent"   (only if it was named something else like "Slot 2")
```

### Step 10: Confirm Completion

Tell the user:

```
Workflow slots have been reserved and claimed!

Summary:
┌─────────────────┬──────────────────────────────────────┬──────────────────────────────────────┐
│ Workflow        │ DEV ID                               │ PROD ID                              │
├─────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
│ Support Agent   │ abc123                               │ def456                               │
│ List Invoices   │ ghi789                               │ jkl012                               │
└─────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘

The DEV workflows have been renamed in n8n (prefixed with {devPrefix}). PROD workflows keep their names.

Next steps:
1. Build your workflows in the DEV slots
2. When ready, use the "Promote" skill to push to prod
```

## Handling Existing Workflows

If the user has existing workflows they want to import:

1. Ask for the workflow names/IDs
2. Pull each workflow
3. Verify they're in the correct folder
4. Add them to id-mappings.json with appropriate status and localPath
5. Optionally rename DEV copies to follow conventions (prepend devPrefix)

## Error Handling

| Error | Resolution |
|-------|------------|
| Can't find new workflows | Ask user to verify they created them in correct folder |
| Duplicate IDs | Prevent - each ID can only be claimed once |
| project.json missing | Run Getting Started skill first |
| MCP not available | Provide manual instructions for user |

## Validation Checks

Before claiming:
1. ✅ Verify each ID is unique (not already in mappings)
2. ✅ Verify workflow exists in n8n
3. ✅ Verify naming doesn't conflict with existing entries

## MCP Commands Used

This skill uses the following n8n MCP operations:
- `n8n_list_workflows` - List workflows (always pass `projectId`). Returns id, name, active, createdAt, updatedAt, tags, nodeCount.
- `n8n_get_workflow` - Get specific workflow by ID (mode: "full" to verify `shared[0].projectId`)
- `n8n_update_partial_workflow` - Rename workflows after claiming (use `updateName` operation)

## Related Skills

- `n8n-getting-started.md` - Run before this skill
- `push-workflow.md` - After reserving, use this to push content
- `pull-workflow.md` - Can be used to import existing workflows
