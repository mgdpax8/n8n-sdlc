---
name: n8n-sdlc-diff-workflow
description: Compare local workflow JSON against the remote version in n8n to detect drift. Use before pushing to see what changed, or when user says "diff workflow", "compare workflow", "check for changes", or "what changed".
---

Compare local workflow JSON against the remote version in n8n to detect drift.

## When to Use

- Before pushing, to see what will change
- To check if someone edited a workflow in n8n since last pull
- User says "diff workflow", "compare workflow", "check for changes", "what changed"

## Prerequisites

- `n8n-sdlc/config/project.json` must exist
- `n8n-sdlc/config/id-mappings.json` must exist
- Local workflow file must exist
- n8n MCP server must be available

## Steps

### Step 1: Identify the Workflow

Accept workflow by:
- **Local file path**: Resolve via id-mappings (see Step 2)
- **Logical name + environment**: "Support Agent" (dev or prod)
- **Full workflow name**: PROD = "Support Agent", DEV = "DEV-Support Agent"

Logical name = PROD name = id-mappings key.

### Step 2: Resolve Local File Path

1. Look up the workflow in `n8n-sdlc/config/id-mappings.json` by PROD name (the key).
2. Use `localPath` from the workflow mapping for file resolution.
3. File name convention: PROD = `{name}.json`, DEV = `DEV-{name}.json`
4. Full path: `{localPath}/{DEV-Support Agent}.json` (e.g., `agents/DEV-Support Agent.json`)

**Self-healing**: If the file is not found at the expected path:
- Check if the file exists elsewhere under the project (e.g., moved to a different folder)
- If found, update `localPath` in id-mappings.json to the correct folder
- If not found, prompt user to pull the workflow first

### Step 3: Load Local Version

Read the local workflow JSON file at the resolved path.

### Step 4: Fetch Remote Version

```
MCP Tool: n8n_get_workflow
Parameters:
  - id: {workflow ID from id-mappings.json}
  - mode: "full"
```

### Step 5: Version Check

Compare `versionId` values:

```
Local versionId (from audit.lastVersionId): {local}
Remote versionId (from n8n):               {remote}

If they match: No remote changes since last sync.
If they differ: Remote has been modified.
```

### Step 6: Compare Key Fields

Compare the following fields between local and remote:

| Field | Local | Remote | Changed? |
|-------|-------|--------|----------|
| name | | | |
| node count | | | |
| active | N/A | {value} | |
| versionId | | | |
| versionCounter | N/A | {value} | |

### Step 7: Detailed Node Comparison

For each node, compare:
- Node exists in both versions
- Node parameters match
- Node credentials match
- Node position (informational only)

Report:
```
DIFF REPORT: DEV-Support Agent
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

### Step 8: Provide Recommendation

Based on the diff:
- **No changes**: "Local and remote are in sync."
- **Local only**: "You have local changes ready to push."
- **Remote only**: "Remote has changes. Pull before making local edits."
- **Both changed**: "Both local and remote have changes. Pull first, review, then push."

## Error Handling

| Error | Resolution |
|-------|------------|
| Local file not found | Self-heal: search for file elsewhere; if found, update localPath in id-mappings. If not found, pull the workflow first |
| Workflow not in n8n | Check if ID is correct in id-mappings.json |
| No lastVersionId in audit | Cannot do version check; compare node-by-node instead |

## MCP Commands Used

- `n8n_get_workflow` - Fetch remote workflow for comparison (mode: "full")

## Related Skills

- `n8n-sdlc-pull-workflow` - Pull latest if remote has changes
- `n8n-sdlc-push-workflow` - Push after confirming diff looks correct
- `n8n-sdlc-validate-workflow` - Validate before operations
