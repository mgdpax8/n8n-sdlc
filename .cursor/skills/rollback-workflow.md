# Skill: Rollback Workflow

Restore a workflow to a previous version using n8n's built-in version history.

## When to Use

- After a promotion causes issues in production
- After a push introduces a bug
- User says "rollback", "revert", "undo promotion", "restore previous version"

## Prerequisites

- `config/project.json` must exist
- `config/id-mappings.json` must exist
- Target workflow must exist in n8n with version history
- n8n MCP server must be available

## Steps

### Step 1: Identify the Workflow to Rollback

Accept workflow by:
- **Logical name**: "Invoice Agent"
- **Full name**: "PROD-BillingBot-InvoiceAgent"
- **n8n ID**: "xyz789ProdId"

### Step 2: Resolve the Workflow ID

Look up the ID in id-mappings.json based on the name and environment.

### Step 3: List Version History

```
MCP Tool: n8n_workflow_versions
Parameters:
  - mode: "list"
  - workflowId: {resolved workflow ID}
  - limit: 10
```

Present the version list to the user:

```
Version history for PROD-BillingBot-InvoiceAgent:

| # | Version ID | Date | Description |
|---|-----------|------|-------------|
| 1 | (current) | 2026-02-23 20:01 | Current version |
| 2 | v-abc123  | 2026-02-23 18:30 | Previous version |
| 3 | v-def456  | 2026-02-22 14:00 | Earlier version |
...

Which version do you want to rollback to?
```

### Step 4: Confirm Rollback

```
⚠️ ROLLBACK WARNING

You are about to rollback:

  Workflow: PROD-BillingBot-InvoiceAgent
  Target ID: xyz789ProdId
  Rolling back to: Version v-abc123 (2026-02-23 18:30)

n8n will automatically backup the current version before rollback.

If the workflow is ACTIVE, the rollback will be PUBLISHED IMMEDIATELY.

Type "confirm" to proceed, or anything else to cancel.
```

### Step 5: Execute Rollback

```
MCP Tool: n8n_workflow_versions
Parameters:
  - mode: "rollback"
  - workflowId: {resolved workflow ID}
  - versionId: {selected version ID}
  - validateBefore: true
```

The `validateBefore: true` parameter validates the workflow structure before applying the rollback, catching any incompatibilities.

### Step 6: Verify Rollback

```
1. Check MCP response for errors
2. Call n8n_get_workflow to verify the rollback was applied
3. Compare node count and key settings
```

### Step 7: Update Audit Trail

Update `config/id-mappings.json`:

```json
{
  "audit": {
    "lastRollback": "2026-02-23T20:30:00Z",
    "rolledBackToVersion": "v-abc123",
    "lastVersionId": "{new versionId after rollback}"
  }
}
```

### Step 8: Confirm Completion

```
✅ ROLLBACK SUCCESSFUL

Workflow: PROD-BillingBot-InvoiceAgent
Rolled back to: Version v-abc123 (2026-02-23 18:30)
Previous version backed up by n8n automatically.

⚠️ Please verify the workflow is working correctly in n8n.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| No version history | Cannot rollback; check if workflow has been updated via MCP before |
| Validation failed | The target version may be incompatible with current n8n; try a different version |
| User didn't confirm | Operation cancelled; no changes made |

## MCP Commands Used

- `n8n_workflow_versions` (mode: "list") - List version history
- `n8n_workflow_versions` (mode: "rollback") - Execute rollback with automatic backup
- `n8n_get_workflow` - Verify rollback result

## Related Skills

- `promote-workflow.md` - Rollback is the safety net for failed promotions
- `push-workflow.md` - Rollback can undo a bad push
- `validate-workflow.md` - Validate after rollback
