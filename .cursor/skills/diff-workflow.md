# Skill: Diff Workflow

Compare local workflow JSON against the remote version in n8n to detect drift.

## When to Use

- Before pushing, to see what will change
- To check if someone edited a workflow in n8n since last pull
- User says "diff workflow", "compare workflow", "check for changes", "what changed"

## Prerequisites

- `config/project.json` must exist
- `config/id-mappings.json` must exist
- Local workflow file must exist
- n8n MCP server must be available

## Steps

### Step 1: Identify the Workflow

Accept workflow by:
- **Local file path**: `agents/DEV-BillingBot-InvoiceAgent.json`
- **Logical name + environment**: "Invoice Agent" (dev or prod)
- **Full workflow name**: "DEV-BillingBot-InvoiceAgent"

### Step 2: Load Local Version

Read the local workflow JSON file.

### Step 3: Fetch Remote Version

```
MCP Tool: n8n_get_workflow
Parameters:
  - id: {workflow ID from id-mappings.json}
  - mode: "full"
```

### Step 4: Version Check

Compare `versionId` values:

```
Local versionId (from audit.lastVersionId): {local}
Remote versionId (from n8n):               {remote}

If they match: No remote changes since last sync.
If they differ: Remote has been modified.
```

### Step 5: Compare Key Fields

Compare the following fields between local and remote:

| Field | Local | Remote | Changed? |
|-------|-------|--------|----------|
| name | | | |
| node count | | | |
| active | N/A | {value} | |
| versionId | | | |
| versionCounter | N/A | {value} | |

### Step 6: Detailed Node Comparison

For each node, compare:
- Node exists in both versions
- Node parameters match
- Node credentials match
- Node position (informational only)

Report:
```
DIFF REPORT: DEV-BillingBot-InvoiceAgent
═══════════════════════════════════════════

Version Status:
  Local versionId:  abc123
  Remote versionId: def456
  Status: REMOTE HAS CHANGES (or IN SYNC)

Node Changes:
  Added remotely:   [list any nodes in remote but not local]
  Removed remotely: [list any nodes in local but not remote]
  Modified:         [list nodes with parameter differences]
  Unchanged:        [count]

Connection Changes:
  [any differences in connections]

Recommendation:
  - If remote has changes: Pull before pushing to avoid overwriting
  - If local has changes: Safe to push
  - If both have changes: Pull first, merge manually, then push
```

### Step 7: Provide Recommendation

Based on the diff:
- **No changes**: "Local and remote are in sync."
- **Local only**: "You have local changes ready to push."
- **Remote only**: "Remote has changes. Pull before making local edits."
- **Both changed**: "Both local and remote have changes. Pull first, review, then push."

## Error Handling

| Error | Resolution |
|-------|------------|
| Local file not found | Pull the workflow first |
| Workflow not in n8n | Check if ID is correct in id-mappings.json |
| No lastVersionId in audit | Cannot do version check; compare node-by-node instead |

## MCP Commands Used

- `n8n_get_workflow` - Fetch remote workflow for comparison (mode: "full")

## Related Skills

- `pull-workflow.md` - Pull latest if remote has changes
- `push-workflow.md` - Push after confirming diff looks correct
- `validate-workflow.md` - Validate before operations
