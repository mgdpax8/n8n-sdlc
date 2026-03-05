---
name: n8n-sdlc-import-project
description: Discover, graph, and register all workflows in an n8n project. Reads config from the getting-started wizard. Use when user says "import my project", "discover workflows", or after the getting-started wizard completes.
---

Discovery engine that finds, graphs, and registers all workflows in an n8n project. Reads configuration created by the getting-started wizard -- does not create config or ask setup questions.

## When to Use

- Automatically after the getting-started wizard (Options 1 or 2)
- User says "import my project", "discover workflows", "pull my workflows"
- `n8n-sdlc/config/project.json` already exists with `n8nProjectId` set

## Prerequisites

- `n8n-sdlc/config/project.json` must exist with `n8nProjectId` set. If missing, tell the user: **"Run the get-started skill first to set up your project."**
- n8n MCP server must be available

## Step 1: Load Configuration

Read `n8n-sdlc/config/project.json` to get:
- `n8nProjectId` (required -- locks all MCP operations to this project)
- `discoveryMode` (`"master"` or `"full-project"`)
- `masterWorkflowId` (only when `discoveryMode` is `"master"`)
- `workflowsDir` (base path for local files)
- `folderStrategy` (how to organize files)
- `naming.devPrefix` (for later DEV slot naming)

Read `n8n-sdlc/config/id-mappings.json` to check for any existing registrations.

If `discoveryMode` is not set in config (e.g., user invoked n8n-sdlc-import-project directly with existing config), ask:

```
How would you like to discover your workflows?

1. Start from a master workflow -- I'll follow all workflow references
   recursively to build the complete dependency tree.

2. Pull all workflows in the project -- I'll list everything in
   your n8n project and build the dependency graph from there.
```

If the user picks master and `masterWorkflowId` is not in config, ask for the workflow name or ID.

## Step 2: Discover Workflows

### Mode A: Master Workflow Traversal

Best when there is a clear entry-point workflow (an agent that calls sub-agents and tools).

1. Fetch the master workflow via MCP:
   ```
   MCP Tool: n8n_get_workflow
   Parameters:
     - id: {masterWorkflowId from config}
     - mode: "full"
   ```
2. Verify `shared[0].projectId` matches `n8nProjectId`. If not, reject.
3. Add to the discovered set
4. Scan all nodes for workflowId references (see Step 3)
5. For each referenced workflow, recursively fetch and scan

### Mode B: Full Project Pull

Best when there are multiple independent workflows or no clear hierarchy.

1. List all workflows in the project:
   ```
   MCP Tool: n8n_list_workflows
   Parameters:
     - projectId: {n8nProjectId}
     - limit: 100
   ```
   Handle pagination with `hasMore`/`nextCursor` if needed.

2. For each workflow in the list, fetch full details:
   ```
   MCP Tool: n8n_get_workflow
   Parameters:
     - id: {workflow ID}
     - mode: "full"
   ```

3. Add each to the discovered set
4. Scan all nodes for workflowId references (see Step 3)

## Step 3: Scan for Workflow References

For each discovered workflow, scan its nodes for references to other workflows:

```
Search nodes for:
- type: "@n8n/n8n-nodes-langchain.toolWorkflow"
- type: "n8n-nodes-base.executeWorkflow"

Extract each node.parameters.workflowId.value
```

For each referenced workflow ID:

1. **Already in discovered set?** Skip (already processed)
2. **Fetch via MCP:**
   ```
   MCP Tool: n8n_get_workflow
   Parameters:
     - id: {referenced workflow ID}
     - mode: "full"
   ```
3. **Check project ownership:** Compare `shared[0].projectId` to `n8nProjectId`
   - **Matches (in-project):** Add to discovered set, recurse into it
   - **Does not match (external):** Add to external dependencies list, do NOT recurse
   - **Workflow not found (deleted or inaccessible):** Warn user, add to issues list

Continue until no new workflows are discovered (all references resolved).

## Step 4: Build Dependency Graph

After discovery, build the complete graph:

```
For each discovered workflow:
  - List which workflows it calls (children)
  - List which workflows call it (parents)
  - Count how many parents reference it (for shared vs dedicated classification)
  - Check if it contains any @n8n/n8n-nodes-langchain.* nodes (agent vs tool)
```

Classify each workflow:
- **Agent**: Contains any `@n8n/n8n-nodes-langchain.agent`, `@n8n/n8n-nodes-langchain.chainLlm`, or similar AI nodes
- **Tool**: No AI nodes (plain automation workflow)

Determine hierarchy:
- **Top-level**: Not called by any other in-project workflow (0 parents)
- **Sub-agent**: Is an agent AND is called by another agent
- **Shared tool**: Called by 2+ workflows
- **Dedicated tool**: Called by exactly 1 workflow

## Step 5: Present Discovery Results

Show the user what was found:

```
DISCOVERY RESULTS
===========================================================

Project: {projectName}
n8n Project ID: {n8nProjectId}
Discovery mode: {Master workflow / Full project}

IN-PROJECT WORKFLOWS ({count}):
-----------------------------------------------------------
  Agents:
    Support Agent (top-level, entry point)
      -> calls: Billing Agent, Ticket Lookup, Shared Lookup Tool [external]
    Billing Agent (sub-agent, called by Support Agent)
      -> calls: List Invoices, Get Totals

  Tools:
    Ticket Lookup (dedicated to Support Agent)
    List Invoices (dedicated to Billing Agent)
    Get Totals (shared: Billing Agent, Reporting Agent)

EXTERNAL DEPENDENCIES ({count}):
-----------------------------------------------------------
  Shared Lookup Tool (ID: extId123)
    Referenced by: Support Agent
    Project: {different projectId}
    NOTE: Not managed by this SDLC. Same ID in DEV and PROD.

DEPENDENCY TREE:
-----------------------------------------------------------
  Support Agent
  ├── Billing Agent [agent]
  │   ├── List Invoices [tool]
  │   └── Get Totals [tool, shared]
  ├── Ticket Lookup [tool]
  └── Shared Lookup Tool [EXTERNAL]
```

## Step 6: Assign Local Paths

Read `folderStrategy` and `workflowsDir` from config. All paths are prefixed with `workflowsDir` if set.

**Flat strategy:**
| Classification | localPath |
|---------------|-----------|
| Any agent | `{workflowsDir}agents/` |
| Any tool | `{workflowsDir}tools/` |

**Categorized strategy:**
| Classification | localPath |
|---------------|-----------|
| Top-level agent | `{workflowsDir}agents/` |
| Sub-agent | `{workflowsDir}agents/agents/` |
| Shared tool | `{workflowsDir}tools/` |
| Dedicated tool (flat) | `{workflowsDir}tools/` |
| Dedicated tool (grouped) | `{workflowsDir}tools/{parent-name}/` |
| Dedicated tool (alongside) | Same as parent's `localPath` |

Create any necessary directories.

## Step 7: Register Workflows as PROD

All discovered in-project workflows are registered as PROD entries (they are the existing production workflows):

```json
{
  "workflows": {
    "Support Agent": {
      "type": "agent",
      "localPath": "agents/",
      "dev": {
        "id": null,
        "status": "needs-slot"
      },
      "prod": {
        "id": "existingProdId",
        "status": "active"
      },
      "audit": {
        "lastLocalPull": "{ISO timestamp}"
      }
    }
  }
}
```

Register external dependencies:

```json
{
  "externalDependencies": {
    "Shared Lookup Tool": {
      "id": "extId123",
      "referencedBy": ["Support Agent"],
      "note": "Outside project. Not managed by SDLC."
    }
  }
}
```

## Step 8: Save Workflow JSON Files Locally

For each in-project workflow, save the fetched JSON to the assigned path:

```
{localPath}{workflow name}.json

Examples:
  agents/Support Agent.json
  agents/agents/Billing Agent.json
  tools/List Invoices.json
  tools/Support Agent/Ticket Lookup.json  (if grouped strategy)
```

## Step 9: Create DEV Slots

After registering all workflows as PROD, check `n8n-sdlc/config/project.json` for `slotCreator.webhookUrl`.

### If Slot Creator is configured:

Offer to auto-create DEV slots immediately:

```
NEXT STEP: DEV Slot Creation
===========================================================

You have {N} production workflows registered. I can auto-create
{N} DEV slots using the Slot Creator.

Shall I create and claim {N} DEV slots now? (yes/no)

DEV workflows to create:
  - DEV-Support Agent
  - DEV-Billing Agent
  - DEV-List Invoices
  - DEV-Ticket Lookup
  - DEV-Get Totals
```

If the user says **yes**: invoke the reserve skill logic directly in handoff mode. The reserve skill will read `id-mappings.json` for all `dev.status: "needs-slot"` entries and use the Slot Creator webhook to create and claim them.

If the user says **no** or **later**: show the manual instructions below and let the user run "reserve workflows" when ready.

### If Slot Creator is NOT configured:

Show manual instructions:

```
NEXT STEP: DEV Slot Creation
===========================================================

You have {N} production workflows registered. To enable the
DEV/PROD workflow, you need {N} empty DEV slots.

Say "reserve workflows" and I'll walk you through creating
and claiming them.

DEV workflows needed:
  - DEV-Support Agent
  - DEV-Billing Agent
  - DEV-List Invoices
  - DEV-Ticket Lookup
  - DEV-Get Totals

TIP: Set up the Slot Creator helper workflow to automate this
step. See n8n-sdlc/helpers/README.md for instructions.
```

### In both cases, include the recommended seeding order:

```
RECOMMENDED SEEDING ORDER (bottom-up):
  1. Get Totals, List Invoices, Ticket Lookup (leaf tools)
  2. Billing Agent (sub-agent)
  3. Support Agent (top-level agent)

Seeding bottom-up ensures DEV tool references are available
when seeding the agents that call them.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Run the get-started skill first |
| n8nProjectId not set | Run the get-started skill to configure |
| MCP not available | Cannot discover; check MCP connection |
| Workflow not found | May have been deleted; skip and warn |
| Master workflow not in project | Verify the ID and project settings |
| Pagination needed | Follow nextCursor for full listing |
| Existing registrations | Warn about conflicts; ask to overwrite or skip |

## MCP Commands Used

- `n8n_list_workflows` - List all workflows in project (Mode B; always pass `projectId`)
- `n8n_get_workflow` - Fetch full workflow for scanning (mode: "full")

## Step 10: Git Sync

After saving all workflow files, run the **n8n-sdlc-git-sync** skill with:
- Files: all saved workflow JSONs, `n8n-sdlc/config/id-mappings.json`, `n8n-sdlc/config/project.json`
- Message: `[import] Initial import: {N} workflows discovered`
- Example: `[import] Initial import: 5 workflows discovered`

This creates the first commit in the project repo with the full baseline.

## What This Skill Does NOT Do

- Does NOT create config files (get-started does that)
- Does NOT ask about storage location or folder strategy (get-started does that)
- Does NOT create DEV workflows (use n8n-sdlc-reserve-workflows + n8n-sdlc-seed-dev)
- Does NOT modify any workflows in n8n (read-only discovery)
- Does NOT pull or manage external dependencies
- Does NOT activate or deactivate workflows

## Related Skills

- **n8n-sdlc-getting-started** - Run before this to create config (the wizard)
- **n8n-sdlc-reserve-workflows** - Run after this to claim DEV slots
- **n8n-sdlc-seed-dev** - Run after reserving to populate DEV from PROD
- **n8n-sdlc-git-sync** - Called automatically after import to commit the baseline
- **n8n-sdlc-project-status** - View the state after import
