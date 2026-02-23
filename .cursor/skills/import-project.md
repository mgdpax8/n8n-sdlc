# Skill: Import Project

The primary entry point for onboarding an n8n project into the SDLC system. Give it a project ID and it handles everything: creates config files, discovers workflows, builds the dependency graph, and registers them.

## When to Use

- First time setting up SDLC for a project (most common entry point)
- User says "import my project", "import project with ID xyz", "set up SDLC", "onboard my workflows"
- User provides an n8n project ID

## Prerequisites

- n8n MCP server must be available
- User must know their n8n project ID (from any workflow URL: `projectId=...`)

## Step 0: Initialize Project

If `config/project.json` does NOT exist, set up the project:

1. The user must provide `n8nProjectId` (required). They can pass it inline: "Import my project, ID is xyz"

2. Ask if they want defaults or custom storage:
   ```
   Quick setup: Do you want to use defaults, or choose where workflow files are stored?

   1. Use defaults -- workflow files go in agents/ and tools/ at the workspace root
   2. Choose a folder -- specify a base directory for all workflow files
   ```

   If the user chooses a custom folder, ask for the path:
   ```
   What folder should I store workflow files in?
   (e.g., "workflows/", "src/n8n/", "my-project/")

   I'll create agents/ and tools/ subfolders inside it.
   ```

3. Create `config/project.json`:
   ```json
   {
     "n8nProjectId": "{provided project ID}",
     "projectName": "",
     "workflowsDir": "",
     "naming": { "devPrefix": "DEV-" },
     "folderStrategy": { "mode": "flat", "dedicatedTools": "flat" },
     "tags": { "dev": ["environment:dev"], "prod": ["environment:prod"] },
     "credentials": {},
     "createdAt": "{ISO timestamp}",
     "version": "2.0"
   }
   ```
   Set `workflowsDir` to the user's chosen path (e.g., `"workflows/"`) or `""` for default.

4. Create `config/id-mappings.json`:
   ```json
   {
     "workflows": {},
     "externalDependencies": {},
     "reservedSlots": [],
     "credentials": {},
     "metadata": {
       "projectName": "",
       "createdAt": "{ISO timestamp}",
       "lastModified": "{ISO timestamp}"
     }
   }
   ```

5. Create directories:
   - If `workflowsDir` is set: create `{workflowsDir}agents/` and `{workflowsDir}tools/`
   - If default: create `agents/` and `tools/` at workspace root

All `localPath` values in id-mappings will be prefixed with `workflowsDir` (e.g., `workflows/agents/` instead of `agents/`).

If config files already exist, read them and continue (use the existing `workflowsDir`).

## Discovery Modes

Ask the user which mode to use:

```
How would you like to discover your workflows?

1. Start from a master workflow -- I'll follow all workflow references
   recursively to build the complete dependency tree.

2. Pull all workflows in the project -- I'll list everything in
   your n8n project and build the dependency graph from there.
```

### Mode A: Master Workflow Traversal

Best when there is a clear entry-point workflow (an agent that calls sub-agents and tools).

### Mode B: Full Project Pull

Best when there are multiple independent workflows or no clear hierarchy.

## Steps

### Step 1: Load Configuration

Read `config/project.json` to get:
- `n8nProjectId` (required for all MCP calls)
- `naming.devPrefix` (for later DEV slot naming)

Read `config/id-mappings.json` to check for any existing registrations.

### Step 2: Discover Workflows

#### Mode A: Master Workflow Traversal

1. Ask user for the master workflow (name or ID)
2. Fetch it via MCP:
   ```
   MCP Tool: n8n_get_workflow
   Parameters:
     - id: {master workflow ID}
     - mode: "full"
   ```
3. Verify `shared[0].projectId` matches `n8nProjectId`. If not, reject.
4. Add to the discovered set
5. Scan all nodes for workflowId references (see Step 3)
6. For each referenced workflow, recursively fetch and scan

#### Mode B: Full Project Pull

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

### Step 3: Scan for Workflow References

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

### Step 4: Build Dependency Graph

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

### Step 5: Present Discovery Results

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

### Step 6: Offer Folder Categorization

After presenting the results, proactively offer folder organization:

```
I found {N} workflows. I can organize them into folders based on
their type (AI agent vs plain tool) and how they call each other.
This creates a hierarchy that mirrors your workflow architecture.

Would you like me to:

1. Organize into categorized folders (recommended for complex projects)
   - Top-level agents -> agents/
   - Sub-agents -> agents/agents/
   - Shared tools -> tools/
   - Dedicated tools -> (choose: flat in tools/, grouped by parent, or alongside parent)

2. Keep it simple with flat folders
   - All agents -> agents/
   - All tools -> tools/
```

**If user chooses categorized:** Ask about dedicated tool placement:
```
For tools used by only one workflow, where should they go?

1. Flat -- all in tools/ (simplest)
2. Grouped by parent -- in tools/{parent-name}/ subfolders
3. Alongside parent -- in the same folder as the calling workflow
```

**Update project.json** `folderStrategy` based on choice:
```json
{
  "folderStrategy": {
    "mode": "categorized",
    "dedicatedTools": "grouped"
  }
}
```

### Step 7: Assign Local Paths

Based on the chosen folder strategy, assign `localPath` for each workflow:

**Flat strategy:**
| Classification | localPath |
|---------------|-----------|
| Any agent | `agents/` |
| Any tool | `tools/` |

**Categorized strategy:**
| Classification | localPath |
|---------------|-----------|
| Top-level agent | `agents/` |
| Sub-agent | `agents/agents/` |
| Shared tool | `tools/` |
| Dedicated tool (flat) | `tools/` |
| Dedicated tool (grouped) | `tools/{parent-name}/` |
| Dedicated tool (alongside) | Same as parent's `localPath` |

Create any necessary directories.

### Step 8: Register Workflows as PROD

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

### Step 9: Save Workflow JSON Files Locally

For each in-project workflow, save the fetched JSON to the assigned path:

```
{localPath}{workflow name}.json

Examples:
  agents/Support Agent.json
  agents/agents/Billing Agent.json
  tools/List Invoices.json
  tools/Support Agent/Ticket Lookup.json  (if grouped strategy)
```

### Step 10: Prompt for DEV Slot Creation

Tell the user how many DEV slots are needed:

```
NEXT STEPS: DEV Slot Creation
===========================================================

You have {N} production workflows registered. To enable the
DEV/PROD workflow, you need {N} empty DEV slots.

Please go to n8n and create {N} empty workflows in your
project folder.

Name suggestions (or use any names -- they'll be renamed):
  1. DEV slot 1
  2. DEV slot 2
  ...

When done, say "reserve workflows" and I'll claim the slots
and rename them to your DEV workflow names:
  - DEV-Support Agent
  - DEV-Billing Agent
  - DEV-List Invoices
  - DEV-Ticket Lookup
  - DEV-Get Totals

After reserving, use the "seed dev" skill to populate each DEV
workflow from its PROD version (with ID transformation).

RECOMMENDED ORDER (bottom-up):
  1. Get Totals, List Invoices, Ticket Lookup (leaf tools)
  2. Billing Agent (sub-agent)
  3. Support Agent (top-level agent)

Seeding bottom-up ensures DEV tool references are available
when seeding the agents that call them.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Run getting-started skill first |
| n8nProjectId not set | Update project.json with project ID from n8n URL |
| MCP not available | Cannot discover; check MCP connection |
| Workflow not found | May have been deleted; skip and warn |
| Master workflow not in project | Verify the ID and project settings |
| Pagination needed | Follow nextCursor for full listing |
| Existing registrations | Warn about conflicts; ask to overwrite or skip |

## MCP Commands Used

- `n8n_list_workflows` - List all workflows in project (Mode B; always pass `projectId`)
- `n8n_get_workflow` - Fetch full workflow for scanning (mode: "full")

## What This Skill Does NOT Do

- Does NOT create DEV workflows (use reserve-workflows + seed-dev)
- Does NOT modify any workflows in n8n (read-only discovery)
- Does NOT pull or manage external dependencies
- Does NOT activate or deactivate workflows

## Related Skills

- `n8n-getting-started.md` - Run before this to create project.json
- `reserve-workflows.md` - Run after this to claim DEV slots
- `seed-dev.md` - Run after reserving to populate DEV from PROD
- `project-status.md` - View the state after import
