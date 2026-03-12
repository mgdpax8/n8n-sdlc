---
name: n8n-sdlc-reserve-workflows
description: Reserve and claim workflow slots in n8n using the reserve-and-claim pattern. Use when user needs new DEV or PROD slots, says "reserve workflows", "claim slots", or after importing a project.
---

Reserve and claim workflow slots in n8n using the "Reserve and Claim" pattern.

## When to Use

- After the import-project skill discovers workflows (handoff mode)
- After the getting-started wizard for greenfield projects
- User says "reserve workflows", "claim slots", "set up workflow IDs"

## Why This Pattern Exists

**The n8n MCP server and REST API create new workflows in the "Personal" folder, not in project folders.**

To get workflows into the correct project folder, we either:

- **Automated path**: Use the Slot Creator helper workflow (webhook) to bulk-create and transfer workflows to the project folder
- **Manual path**: Have the user create empty workflows in the n8n UI, then pull and claim them

## Prerequisites

- `n8n-sdlc/config/project.json` must exist (run Getting Started first)
- `n8n-sdlc/config/id-mappings.json` must exist
- n8n MCP server must be available

## Step 1: Determine Input Mode

Check how this skill was invoked:

### Mode A: Handoff from Import

If invoked after the import-project skill, the needed slots are already known. Read `n8n-sdlc/config/id-mappings.json` and find all workflows with `dev.status: "needs-slot"`:

```
Read id-mappings.json
Filter workflows where dev.status === "needs-slot"
These are the workflows that need DEV slots.
```

Skip to Step 2 with this pre-built list. Do NOT ask the user what workflows they need.

### Mode B: Standalone (User-Invoked)

Ask the user what workflows they need:

```
What workflows do you need to create?

For each workflow, do you need:
  1. DEV slot only (you already have a PROD workflow)
  2. Both DEV and PROD slots (new/greenfield workflow)

Please list the workflow names (these are the production names):
1. Support Agent
2. List Invoices
3. Get Invoice Totals
```

### Mode C: Greenfield

If the project has no existing workflows (fresh setup), all workflows need BOTH DEV and PROD slots:

```
Total slots = Number of workflows × 2
```

## Step 2: Calculate Slots Needed

Count the total empty workflow slots required:

| Scenario | Slots per workflow |
|----------|--------------------|
| Post-import (DEV only) | 1 |
| Greenfield (DEV + PROD) | 2 |
| Mixed | Varies |

Build a names list for the slots. For DEV slots, use `{devPrefix}{WorkflowName}`. For PROD slots, use `{WorkflowName}`.

Read `naming.devPrefix` from `n8n-sdlc/config/project.json` (default: `"DEV-"`).

```
Example (post-import, 5 workflows):
  Slots needed: 5
  Names: ["DEV-Support Agent", "DEV-Billing Agent", "DEV-List Invoices", "DEV-Ticket Lookup", "DEV-Get Totals"]

Example (greenfield, 3 workflows):
  Slots needed: 6
  Names: ["DEV-Support Agent", "Support Agent", "DEV-List Invoices", "List Invoices", "DEV-Get Totals", "Get Totals"]
```

## Step 3: Create Empty Workflow Slots

Read `n8n-sdlc/config/project.json` and check if `slotCreator.webhookUrl` is set.

### Step 3A: Automated Creation (Slot Creator configured)

If `slotCreator.webhookUrl` is set and non-empty:

1. Extract the base URL from the webhook URL (everything before `/webhook/`).
2. Build the request payload:

```json
{
  "projectId": "{n8nProjectId from project.json}",
  "count": {total slots needed},
  "names": ["{list of slot names}"],
  "baseUrl": "{extracted base URL}",
  "apiKey": "{user must provide — ask once, do not store}"
}
```

1. **Ask the user for their n8n API key** (needed for the slot creator to call the n8n REST API). Do not store this value anywhere.

2. Call the webhook:

```bash
curl -s -X POST "{webhookUrl}" \
  -H "Content-Type: application/json" \
  -d '{payload}'
```

1. Parse the response:

```json
{
  "success": true,
  "created": [{"id": "abc123", "name": "DEV-Support Agent"}, ...],
  "count": 5,
  "requested": 5,
  "errors": []
}
```

1. **Verify**: Check that `count` matches `requested`. If `errors` is non-empty, report them.

2. **On total failure** (webhook unreachable, HTTP error, success=false with 0 created): Fall back to Step 3B (manual).

3. **On partial failure** (some created, some failed): Report what was created, ask user if they want to manually create the remaining slots (Step 3B for the remainder) or retry.

### Step 3B: Manual Creation (No Slot Creator or fallback)

If `slotCreator.webhookUrl` is not set or the automated path failed:

```
Please go to n8n and create {N} empty workflows:

1. Go to your n8n instance
2. Navigate to your project folder
3. Create {N} new empty workflows
   - The names don't matter (you can call them "Slot 1", "Slot 2", etc.)
   - Make sure they're in the correct project folder!

When you're done, say "done" and I'll pull them to get their IDs.

TIP: To skip this manual step in the future, set up the Slot Creator
helper workflow. See n8n-sdlc/helpers/README.md for instructions.
```

Wait for user confirmation, then:

1. Use n8n MCP: `n8n_list_workflows` with `projectId` from project.json
2. Filter for empty/minimal workflows (`nodeCount` of 0 or 1)
3. Filter for recently created workflows
4. Present the list to the user for confirmation:

```
I found these empty workflows in your project:

1. ID: abc123 | Name: "Slot 1" | Created: 2026-02-05
2. ID: def456 | Name: "Slot 2" | Created: 2026-02-05
...

Are these the workflows you just created? (yes/no)
```

For each confirmed workflow, call `n8n_get_workflow` (mode: "full") and verify `data.shared[0].projectId` matches `n8nProjectId`. Exclude any that don't match.

## Step 4: Auto-Assign Slots

**Empty slots are fungible** — any empty slot can become any workflow. Do not ask the user to manually assign each slot.

### Automated Path (Step 3A)

Slots were pre-named during creation. Match by name:

```
For each needed workflow:
  Find the created slot whose name matches "{devPrefix}{WorkflowName}" (for DEV)
  or "{WorkflowName}" (for PROD)
  Assign that slot's ID to the workflow
```

### Manual Path (Step 3B)

Assign slots in order:

```
Confirmed empty slots: [abc123, def456, ghi789, jkl012, mno345]
Needed workflows (DEV): [Support Agent, Billing Agent, List Invoices, Ticket Lookup, Get Totals]

Assignment:
  DEV-Support Agent  → abc123
  DEV-Billing Agent  → def456
  DEV-List Invoices  → ghi789
  DEV-Ticket Lookup  → jkl012
  DEV-Get Totals     → mno345
```

Show the mapping and ask for a **single confirmation**:

```
Here's the slot assignment:

┌──────────────────────┬──────────────────┐
│ Workflow             │ Slot ID          │
├──────────────────────┼──────────────────┤
│ DEV-Support Agent    │ abc123           │
│ DEV-Billing Agent    │ def456           │
│ DEV-List Invoices    │ ghi789           │
│ DEV-Ticket Lookup    │ jkl012           │
│ DEV-Get Totals       │ mno345           │
└──────────────────────┴──────────────────┘

Does this look correct? (yes/no)
```

If the user says no, let them swap specific entries. Do not re-ask for each one individually.

## Step 5: Update id-mappings.json

For each claimed workflow, update the entry in `id-mappings.json`:

**Post-import (DEV slots only)** — update existing entries:

```json
{
  "Support Agent": {
    "type": "agent",
    "localPath": "agents/",
    "dev": {
      "id": "abc123",
      "status": "reserved"
    },
    "prod": {
      "id": "existingProdId",
      "status": "active"
    }
  }
}
```

**Greenfield (DEV + PROD)** — create new entries:

```json
{
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
  }
}
```

For `localPath`:

- Default `"agents/"` for AI workflows (type: agent)
- Default `"tools/"` for others (type: tool)
- If the project has `folderStrategy.mode: "categorized"`, use the appropriate nested path

Read `folderStrategy` from `n8n-sdlc/config/project.json`.

## Step 5.5: Clean Up reservedSlots

After claiming, remove stale entries from `reservedSlots` in `id-mappings.json`. For each entry in `reservedSlots`, check if its `id` now appears as any workflow's `dev.id` or `prod.id`. If it does, remove the entry — it has been claimed and is no longer a reserved slot.

If all entries were claimed, set `reservedSlots` to an empty array `[]`.

## Step 6: Rename Workflows in n8n

Use MCP to update workflow names:

- **DEV slots**: Rename to `"{devPrefix}{WorkflowName}"` (e.g., `"DEV-Support Agent"`)
- **PROD slots** (greenfield only): Rename to `"{WorkflowName}"` if the current name doesn't match

**Skip renaming for automated path (3A)** — slots were already created with correct names.

For manual path (3B), rename using:

```
n8n_update_partial_workflow with updateName operation:
  - workflow abc123 → name: "DEV-Support Agent"
  - workflow def456 → name: "DEV-Billing Agent"
  ...
```

## Step 7: Confirm Completion

```
Workflow slots reserved and claimed!

Summary:
┌─────────────────┬──────────────────┬──────────────────┐
│ Workflow        │ DEV ID           │ PROD ID          │
├─────────────────┼──────────────────┼──────────────────┤
│ Support Agent   │ abc123           │ existingProdId   │
│ Billing Agent   │ def456           │ existingProdId2  │
│ List Invoices   │ ghi789           │ existingProdId3  │
└─────────────────┴──────────────────┴──────────────────┘

Next steps:
1. Use the "seed dev" skill to populate DEV from PROD (recommended order: bottom-up)
2. Or build workflows directly in the DEV slots
3. When ready, use the "promote" skill to push to prod
```

If post-import, include the recommended seeding order (bottom-up from leaf tools to top-level agents).

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Run Getting Started skill first |
| id-mappings.json missing | Run Getting Started skill first |
| MCP not available | Provide manual instructions |
| Slot Creator webhook unreachable | Fall back to manual path (Step 3B) |
| Slot Creator partial failure | Report errors, offer manual creation for remainder |
| Can't find empty workflows (manual) | Ask user to verify they created them in correct folder |
| Duplicate IDs | Prevent — each ID can only be claimed once |
| Workflow not in locked project | Exclude from list, warn user |
| Slot count mismatch | Report discrepancy, ask user how to proceed |

## Validation Checks

Before claiming:

1. Verify each ID is unique (not already in id-mappings)
2. Verify workflow exists in n8n (via MCP)
3. Verify workflow is in the locked project (shared[0].projectId check)
4. Verify naming doesn't conflict with existing entries

## MCP Commands Used

- `n8n_list_workflows` — List workflows (always pass `projectId`). Returns id, name, active, createdAt, updatedAt, tags, nodeCount.
- `n8n_get_workflow` — Get specific workflow by ID (mode: "full" to verify `shared[0].projectId`)
- `n8n_update_partial_workflow` — Rename workflows after claiming (use `updateName` operation)

## Git Sync

After claiming slots, run the **n8n-sdlc-git-sync** skill with:

- Files: `n8n-sdlc/config/id-mappings.json`
- Message: `[reserve] Claimed {N} DEV slots`
- Example: `[reserve] Claimed 5 DEV slots`

## Related Skills

- **n8n-sdlc-getting-started** — The setup wizard; run before this skill
- **n8n-sdlc-import-project** — Discovers and registers existing workflows; hands off to this skill
- **n8n-sdlc-seed-dev** — After reserving, populate DEV from PROD
- **n8n-sdlc-push-workflow** — Push local workflow content to n8n
- **n8n-sdlc-pull-workflow** — Pull workflows from n8n to local
- **n8n-sdlc-git-sync** — Called automatically after reserving to commit and push
