# Skill: Promote Workflow

Promote a DEV workflow to PROD with full ID transformation.

## When to Use

- Moving a tested DEV workflow to production
- User says "promote", "deploy to prod", "push to production", "release workflow"

## What Promotion Does

1. Takes a DEV workflow
2. Transforms all IDs (name, workflow references, credentials)
3. Pushes to the corresponding PROD slot

## Critical Safety Rules

1. **Always require explicit confirmation** before pushing to PROD
2. **All referenced workflows must have PROD IDs** mapped
3. **Backup current PROD** before overwriting
4. **Log all transformations** for audit trail

## Prerequisites

- `config/project.json` must exist
- `config/id-mappings.json` must exist
- DEV workflow must exist (locally or in n8n)
- PROD slot must be reserved (prod.id is not null)
- All referenced workflows must have PROD mappings

## Steps

### Step 1: Identify the Workflow to Promote

Accept workflow by:
- **Logical name**: "Invoice Agent"
- **Full DEV name**: "DEV-BillingBot-InvoiceAgent"
- **Local file path**: `agents/DEV-BillingBot-InvoiceAgent.json`

### Step 2: Load Source Workflow

**If local file exists:**
```
Read from: agents/DEV-{Project}-{Name}.json
```

**If no local file:**
```
Pull from n8n using DEV ID from id-mappings.json
```

### Step 3: Verify PROD Slot Exists

Check `config/id-mappings.json`:

```json
{
  "InvoiceAgent": {
    "prod": {
      "id": "xyz789ProdId",  // Must NOT be null
      "status": "reserved"  // or "active"
    }
  }
}
```

**If prod.id is null:**
```
ERROR: No PROD slot reserved for "Invoice Agent"

To promote this workflow, you first need to reserve a PROD slot.
Run the "reserve-workflows" skill to create and claim a PROD slot.
```

### Step 4: Scan for Workflow References

Find all `workflowId` references in the DEV workflow:

```
Search nodes for:
- type: "@n8n/n8n-nodes-langchain.toolWorkflow"
- type: "n8n-nodes-base.executeWorkflow"

Extract each workflowId.value
```

### Step 5: Verify All References Have PROD Mappings

For each found workflow ID:

```
1. Look up the ID in id-mappings.json (search all entries' dev.id)
2. Find the corresponding entry
3. Check if prod.id is not null
```

**If any reference lacks a PROD mapping:**
```
ERROR: Cannot promote - missing PROD mappings

The following workflow references need PROD IDs:

| DEV ID          | Workflow Name  | PROD ID |
|-----------------|----------------|---------|
| pnfqaPMDG9PohkBi| List Invoices  | NULL ❌ |
| abc123          | Get Totals     | NULL ❌ |

Run "reserve-workflows" to create PROD slots for these workflows first.
```

**STOP promotion if any mapping is missing.**

### Step 6: Build Transformation Report

Create a detailed report of what will change:

```
═══════════════════════════════════════════════════════════════════
                    PROMOTION TRANSFORMATION REPORT
═══════════════════════════════════════════════════════════════════

Workflow: Invoice Agent
Source: DEV-BillingBot-InvoiceAgent (ID: abc123)
Target: PROD-BillingBot-InvoiceAgent (ID: xyz789)

TRANSFORMATIONS:
───────────────────────────────────────────────────────────────────
1. Workflow Name
   DEV-BillingBot-InvoiceAgent → PROD-BillingBot-InvoiceAgent

2. Workflow ID  
   abc123 → xyz789

3. Tool References (3 found):
   ┌─────────────────────┬─────────────────┬─────────────────┐
   │ Tool Name           │ DEV ID          │ PROD ID         │
   ├─────────────────────┼─────────────────┼─────────────────┤
   │ List Invoices       │ pnfqaPMDG9PohkBi│ prodListId123   │
   │ Get Invoice Totals  │ tool123abc      │ prodTotalsId456 │
   │ Invoice Diff        │ diff789xyz      │ prodDiffId789   │
   └─────────────────────┴─────────────────┴─────────────────┘

4. Credential Mappings (1 found):
   ┌─────────────────────┬─────────────────┬─────────────────┐
   │ Credential          │ DEV ID          │ PROD ID         │
   ├─────────────────────┼─────────────────┼─────────────────┤
   │ Slack               │ slack-sandbox   │ slack-prod      │
   └─────────────────────┴─────────────────┴─────────────────┘

═══════════════════════════════════════════════════════════════════
```

### Step 7: Request Confirmation

```
⚠️ PRODUCTION DEPLOYMENT ⚠️

You are about to deploy to PRODUCTION.

This will:
1. Backup current PROD workflow
2. Apply the transformations shown above
3. Push to PROD-BillingBot-InvoiceAgent

Type "confirm" to proceed, or anything else to cancel.
```

**Wait for explicit "confirm" response.**

### Step 8: Backup Current PROD

```
1. Pull current PROD workflow from n8n
2. Save to: agents/PROD-BillingBot-InvoiceAgent.backup.{timestamp}.json
3. Log backup location
```

### Step 9: Perform Transformations

Execute the transformation algorithm:

```javascript
// 1. Clone the DEV workflow
prodWorkflow = deepClone(devWorkflow)

// 2. Transform workflow name
prodWorkflow.name = devWorkflow.name.replace("DEV-", "PROD-")

// 3. Transform workflow ID
prodWorkflow.id = idMappings[logicalName].prod.id

// 4. Transform all workflowId references
for (node of prodWorkflow.nodes) {
  if (isWorkflowReferenceNode(node)) {
    devRefId = node.parameters.workflowId.value
    // Find the mapping entry that has this dev ID
    mappingEntry = findMappingByDevId(devRefId)
    // Replace with prod ID
    node.parameters.workflowId.value = mappingEntry.prod.id
  }
}

// 5. Transform credential IDs (if mapped)
for (node of prodWorkflow.nodes) {
  if (node.credentials) {
    for (credType of Object.keys(node.credentials)) {
      credId = node.credentials[credType].id
      if (credentialMappings[credId]) {
        node.credentials[credType].id = credentialMappings[credId].prod
      }
    }
  }
}

// 6. Update tags (optional)
prodWorkflow.tags = updateTagsForProd(prodWorkflow.tags)
```

### Step 10: Push to PROD via MCP

```
MCP Command: update_workflow
Parameters:
  - workflow_id: {PROD ID from mappings}
  - workflow_data: {transformed workflow JSON}
```

### Step 11: Verify Promotion Success

```
1. Check MCP response for errors
2. Pull PROD workflow back from n8n
3. Verify key transformations were applied
4. Compare expected vs actual
```

### Step 12: Update Audit Trail

Update `config/id-mappings.json`:

```json
{
  "InvoiceAgent": {
    "prod": {
      "id": "xyz789",
      "status": "active"  // Update from "reserved"
    },
    "audit": {
      "lastPromoted": "2026-02-05T17:00:00Z",
      "promotionCount": 1,
      "lastPromotionBackup": "agents/PROD-BillingBot-InvoiceAgent.backup.2026-02-05T17-00-00.json"
    }
  }
}
```

### Step 13: Confirm Completion

```
✅ PROMOTION SUCCESSFUL

Workflow: Invoice Agent
Source: DEV-BillingBot-InvoiceAgent
Target: PROD-BillingBot-InvoiceAgent

Transformations Applied:
- Workflow name: ✓
- Workflow ID: ✓
- 3 tool references: ✓
- 1 credential mapping: ✓

Backup saved: agents/PROD-BillingBot-InvoiceAgent.backup.2026-02-05T17-00-00.json

⚠️ Please verify the workflow is working correctly in n8n.
   Test key functionality before considering promotion complete.
```

## Dry-Run Mode

Support `--dry-run` flag to preview without executing:

```
User: "promote Invoice Agent --dry-run"

Response: Shows full transformation report WITHOUT pushing to PROD
```

## Error Handling

| Error | Resolution |
|-------|------------|
| PROD slot not reserved | Run reserve-workflows first |
| Missing tool PROD mapping | Reserve PROD slots for all tools first |
| User didn't confirm | Operation cancelled; no changes made |
| MCP push failed | Retry or investigate; backup is safe |
| Transformation error | Log error; do not push partial result |

## Promotion Checklist

Before promoting, verify:

- [ ] DEV workflow is tested and working
- [ ] All referenced tool workflows have PROD mappings
- [ ] PROD slot is reserved for this workflow
- [ ] Credential mappings exist (if different per env)
- [ ] User has confirmed the transformation report

## Rolling Back a Promotion

If promotion causes issues:

```
1. Locate backup file: agents/PROD-*.backup.{timestamp}.json
2. Use push-workflow skill to push backup to PROD
3. Verify PROD is restored
```

## Related Skills

- `validate-workflow.md` - Called automatically during promotion
- `push-workflow.md` - Used internally to push transformed workflow
- `pull-workflow.md` - Used to backup current PROD
- `reserve-workflows.md` - Must run first to reserve PROD slots
