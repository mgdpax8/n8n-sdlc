---
name: n8n-sdlc-seed-dev
description: Transform a PROD workflow into a DEV-ready copy with ID transformation and push it to the DEV slot. Use when user says "seed dev", "copy prod to dev", "populate dev", or after reserving DEV slots.
---

Transform a PROD workflow into a DEV-ready copy and push it to the DEV slot (reverse promotion).

## When to Use

- After importing existing workflows with n8n-sdlc-import-project skill
- After reserving DEV slots with n8n-sdlc-reserve-workflows skill
- User says "seed dev", "copy prod to dev", "populate dev", "reverse promote", "create dev copy"

## What Seed Does

1. Takes an existing PROD workflow
2. Transforms all IDs in reverse (PROD -> DEV)
3. Pushes the transformed copy to the corresponding DEV slot

This is the inverse of the n8n-sdlc-promote-workflow skill.

## Prerequisites

- `n8n-sdlc/config/project.json` must exist
- `n8n-sdlc/config/id-mappings.json` must exist
- PROD workflow must exist in n8n (prod.id is not null, status is "active")
- DEV slot must be reserved (dev.id is not null)
- For proper seeding of agents, all referenced tool workflows should already have their DEV slots seeded (bottom-up order)

## Steps

### Step 1: Identify the Workflow to Seed

Accept workflow by:
- **Logical name**: "Support Agent" (the id-mappings key / PROD name)
- **"all"**: Seed all workflows that have both PROD active and DEV reserved
- **List**: "Support Agent, List Invoices, Billing Agent"

### Step 2: Determine Seeding Order

If seeding multiple workflows, use the persisted order or compute it:

**First, check `metadata.seedOrder` in id-mappings.json:**
```
If metadata.seedOrder exists and is a non-empty array:
  1. Filter to only workflows being seeded (in case user specified a subset)
  2. Preserve the stored order for matching workflows
  3. Append any workflows not in seedOrder at the end (newly added since import)
```

**If seedOrder is missing or empty, compute bottom-up order:**
```
1. Build dependency graph from id-mappings and workflow JSON
2. Identify leaf nodes (workflows that don't call other in-project workflows)
3. Process leaves first, then their parents, then grandparents, etc.
4. Save the computed order to metadata.seedOrder for future runs

Example order:
  1. Get Totals (tool, leaf)
  2. List Invoices (tool, leaf)
  3. Ticket Lookup (tool, leaf)
  4. Billing Agent (sub-agent, calls Get Totals + List Invoices)
  5. Support Agent (top-level, calls Billing Agent + Ticket Lookup)
```

Bottom-up ordering ensures that when seeding an agent, all its tool/sub-agent DEV IDs are already available for reference transformation.

### Step 3: Load PROD Workflow

For each workflow to seed:

**If local PROD file exists:**
```
Read from: {localPath}{workflow name}.json
e.g., agents/Support Agent.json
```

**If no local file:**
```
MCP Tool: n8n_get_workflow
Parameters:
  - id: {PROD ID from id-mappings}
  - mode: "full"
```

Verify `shared[0].projectId` matches `n8nProjectId`.

### Step 4: Verify DEV Slot Exists

Check `n8n-sdlc/config/id-mappings.json`:

```json
{
  "Support Agent": {
    "dev": {
      "id": "devSlotId123",
      "status": "reserved"
    }
  }
}
```

**If dev.id is null:**
```
ERROR: No DEV slot reserved for "Support Agent"

Run the "n8n-sdlc-reserve-workflows" skill to create and claim a DEV slot first.
```

### Step 5: Scan for Workflow References

Find all `workflowId` references in the PROD workflow:

```
Search nodes for:
- type: "@n8n/n8n-nodes-langchain.toolWorkflow"
- type: "n8n-nodes-base.executeWorkflow"

Extract each workflowId.value
```

### Step 6: Classify Each Reference

For each referenced workflow ID:

1. **In id-mappings workflows (by prod.id)?** -> In-project, will transform to dev.id
2. **In externalDependencies?** -> External, leave as-is
3. **Not found?** -> Warn: unregistered reference

For in-project references, check that dev.id is not null. If any dev.id is null, warn:

```
WARNING: Referenced workflow "{name}" does not have a DEV slot yet.

The workflowId reference will point to the PROD ID in the DEV copy.
Seed or reserve that workflow first for proper DEV isolation.

Continue anyway? (The reference can be updated later)
```

### Step 7: Build Transformation Report

```
SEED DEV TRANSFORMATION REPORT
===========================================================

Workflow: Support Agent
Source: Support Agent (PROD, ID: prodId789)
Target: DEV-Support Agent (DEV, ID: devId123)

TRANSFORMATIONS:
-----------------------------------------------------------
1. Workflow Name
   Support Agent -> DEV-Support Agent

2. Workflow ID
   prodId789 -> devId123

3. Workflow References ({N} in-project, {M} external):
   In-project (will transform):
   +---------------------+-----------------+-----------------+
   | Tool Name           | PROD ID         | DEV ID          |
   +---------------------+-----------------+-----------------+
   | Billing Agent       | prodBilling456  | devBilling123   |
   | Ticket Lookup       | prodTicket789   | devTicket456    |
   +---------------------+-----------------+-----------------+

   External (unchanged):
   +---------------------+-----------------+
   | Tool Name           | ID (unchanged)  |
   +---------------------+-----------------+
   | Shared Lookup Tool  | extId123        |
   +---------------------+-----------------+

4. Credential Mappings ({N} found):
   +---------------------+-----------------+-----------------+
   | Credential          | PROD ID         | DEV ID          |
   +---------------------+-----------------+-----------------+
   | Slack               | slack-prod      | slack-sandbox   |
   +---------------------+-----------------+-----------------+

===========================================================

Proceed with seeding? (y/n)
```

### Step 8: Perform Transformations

```javascript
// 1. Clone the PROD workflow
devWorkflow = deepClone(prodWorkflow)

// 2. Transform workflow name: prepend devPrefix
devWorkflow.name = devPrefix + prodWorkflow.name

// 3. Transform workflow ID
devWorkflow.id = idMappings[logicalName].dev.id

// 4. Transform in-project workflowId references (PROD -> DEV)
for (node of devWorkflow.nodes) {
  if (isWorkflowReferenceNode(node)) {
    prodRefId = node.parameters.workflowId.value

    // Check if external dependency
    if (isExternalDependency(prodRefId)) {
      continue  // Leave unchanged
    }

    // Look up by prod.id to find the mapping
    mappingEntry = findMappingByProdId(prodRefId)
    if (mappingEntry && mappingEntry.dev.id) {
      node.parameters.workflowId.value = mappingEntry.dev.id
    }

    // Strip cached metadata (n8n will re-populate)
    delete node.parameters.workflowId.cachedResultUrl
    delete node.parameters.workflowId.cachedResultName
  }
}

// 5. Transform credential IDs (PROD -> DEV, reverse of promotion)
for (node of devWorkflow.nodes) {
  if (node.credentials) {
    for (credType of Object.keys(node.credentials)) {
      credId = node.credentials[credType].id
      for (alias of Object.keys(projectJson.credentials)) {
        if (projectJson.credentials[alias].prod === credId) {
          node.credentials[credType].id = projectJson.credentials[alias].dev
        }
      }
    }
  }
}

// 6. Update tags (if configured)
devWorkflow.tags = updateTagsForDev(devWorkflow.tags)
```

### Step 9: Push to DEV Slot via MCP

```
MCP Tool: n8n_update_full_workflow
Parameters:
  - id: {DEV slot ID from id-mappings}
  - name: {transformed DEV workflow name}
  - nodes: {transformed nodes array}
  - connections: {connections object}
  - settings: {settings object}

NOTE: DEV slots should be INACTIVE, so this saves without publishing.
```

### Step 10: Verify and Update Audit Trail

After successful push:

1. Verify by calling `n8n_get_workflow` on the DEV slot
2. Update `n8n-sdlc/config/id-mappings.json`:

```json
{
  "Support Agent": {
    "dev": {
      "id": "devId123",
      "status": "active"
    },
    "audit": {
      "lastPush": "{ISO timestamp}",
      "lastPushEnvironment": "dev",
      "lastVersionId": "{versionId from push response}"
    }
  }
}
```

### Step 11: Report Completion

**Single workflow:**
```
SEED COMPLETE

Workflow: Support Agent
DEV copy: DEV-Support Agent (ID: devId123)

Transformations applied:
  - Name: Support Agent -> DEV-Support Agent
  - Workflow ID: prodId789 -> devId123
  - 2 in-project references transformed (PROD -> DEV IDs)
  - 1 external reference left unchanged
  - 1 credential mapping applied (PROD -> DEV)

The DEV workflow is saved but NOT active.
You can now develop in the DEV slot.
```

**Bulk seed (all workflows):**
```
SEED COMPLETE: {N} workflows seeded

Order processed (bottom-up):
  1. Get Totals
  2. List Invoices
  3. Ticket Lookup
  4. Billing Agent
  5. Support Agent

All DEV workflows are saved but NOT active.
Run "project status" to see the full state.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| PROD workflow not found | Check id-mappings; pull from n8n |
| DEV slot not reserved | Run n8n-sdlc-reserve-workflows first |
| Referenced workflow has no DEV slot | Warn; leave PROD ID in DEV copy (can fix later) |
| MCP push failed | Retry; DEV slot may need to be re-created |
| Credential mapping missing | Leave as-is; credentials may be same in both envs |

## MCP Commands Used

- `n8n_get_workflow` - Fetch PROD workflow (mode: "full")
- `n8n_update_full_workflow` - Push transformed DEV copy to DEV slot

### Git Sync

After a successful seed, run the **n8n-sdlc-git-sync** skill with:
- Files: the seeded DEV workflow JSON and `n8n-sdlc/config/id-mappings.json`
- Message: `[seed] {DEV workflow name} from PROD`
- Example: `[seed] DEV-Support Agent from PROD`

## Related Skills

- **n8n-sdlc-getting-started** - The setup wizard; run first to create config
- **n8n-sdlc-import-project** - Run before this to discover and register workflows
- **n8n-sdlc-reserve-workflows** - Run before this to create DEV slots
- **n8n-sdlc-promote-workflow** - The forward version of this (DEV -> PROD)
- **n8n-sdlc-pull-workflow** - Pull latest PROD before seeding if needed
- **n8n-sdlc-git-sync** - Called automatically after seed to commit and push to git
