---
name: n8n-sdlc-promote-workflow
description: Promote a DEV workflow to PROD with full ID transformation for workflow references, credentials, and naming. Use when user says "promote", "deploy to prod", "push to production", or "release workflow".
---

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
2. **All referenced in-project workflows must have PROD IDs** mapped
3. **Backup current PROD** before overwriting
4. **Log all transformations** for audit trail

## Prerequisites

- `n8n-sdlc/config/project.json` must exist
- `n8n-sdlc/config/id-mappings.json` must exist
- DEV workflow must exist (locally or in n8n)
- PROD slot must be reserved (prod.id is not null)
- All referenced in-project workflows must have PROD mappings

## Steps

### Step 1: Identify the Workflow to Promote

Accept workflow by:

- **Logical name** (id-mappings key): "Support Agent"
- **Full DEV name**: "DEV-Support Agent" (devPrefix + name from `n8n-sdlc/config/project.json` `naming.devPrefix`)
- **Local file path**: resolved via `localPath` from id-mappings (see Step 2)

### Step 2: Load Source Workflow

**Resolve local file path:**

```
1. Look up workflow in id-mappings.json by logical name (key = PROD/real name, e.g., "Support Agent")
2. Get localPath from the workflow entry (e.g., "agents/", "tools/")
3. DEV file path = {localPath}{devPrefix}{logicalName}.json
   Example: agents/DEV-Support Agent.json
   (devPrefix from n8n-sdlc/config/project.json naming.devPrefix)
```

**If local file exists at resolved path:**

```
Read from: {localPath}{devPrefix}{logicalName}.json
```

**If file not found at localPath (self-healing):**

```
Search workspace by filename (e.g., "DEV-Support Agent.json")
If found elsewhere, use that path and optionally suggest updating localPath in id-mappings
```

**If no local file found:**

```
Pull from n8n using DEV ID from id-mappings.json
```

### Step 3: Verify PROD Slot Exists

Check `n8n-sdlc/config/id-mappings.json`:

```json
{
  "Support Agent": {
    "type": "agent",
    "localPath": "agents/",
    "prod": {
      "id": "xyz789ProdId",
      "status": "reserved"
    }
  }
}
```

**If prod.id is null:**

```
ERROR: No PROD slot reserved for "Support Agent"

To promote this workflow, you first need to reserve a PROD slot.
Run the "n8n-sdlc-reserve-workflows" skill to create and claim a PROD slot.
```

### Step 4: Scan and Verify Workflow References

Run the deterministic reference scanner:

```bash
node n8n-sdlc/scripts/scan-refs.mjs \
  --workflow "{devFilePath}" \
  --mappings n8n-sdlc/config/id-mappings.json
```

Parse the JSON output and check `summary`:

- If `summary.unmapped > 0`: show the unmapped references and **STOP**
- For each `in-project` reference, verify the workflow has a `prod.id` in id-mappings.json
- `external` references are fine — they use the same ID in both environments

**If any in-project reference lacks a PROD mapping:**

```text
ERROR: Cannot promote - missing PROD mappings

The following workflow references need PROD IDs:

| DEV ID          | Workflow Name   | PROD ID |
|-----------------|-----------------|---------|
| pnfqaPMDG9PohkBi| List Invoices   | NULL    |

Run "n8n-sdlc-reserve-workflows" to create PROD slots for these workflows first.
```

**STOP promotion if any reference is unmapped or missing a PROD ID.**

### Step 6: Build Transformation Report

Create a detailed report of what will change:

```
PROMOTION TRANSFORMATION REPORT

Workflow: Support Agent
Source: DEV-Support Agent (ID: abc123)
Target: Support Agent (ID: xyz789)

TRANSFORMATIONS:
1. Workflow Name
   DEV-Support Agent -> Support Agent (strip devPrefix)

2. Workflow ID  
   abc123 -> xyz789

3. Tool References (3 found):
   +---------------------+-----------------+-----------------+--------------+
   | Tool Name           | DEV ID          | PROD ID         | Type         |
   +---------------------+-----------------+-----------------+--------------+
   | List Invoices       | pnfqaPMDG9PohkBi| prodListId123   | in-project   |
   | Get Invoice Totals  | tool123abc      | prodTotalsId456 | in-project   |
   | Shared Lookup       | ext-workflow-id | (unchanged)     | external     |
   +---------------------+-----------------+-----------------+--------------+

4. Credential Mappings (1 found):
   +---------------------+-----------------+-----------------+
   | Credential          | DEV ID          | PROD ID         |
   +---------------------+-----------------+-----------------+
   | Slack               | slack-sandbox   | slack-prod      |
   +---------------------+-----------------+-----------------+
```

### Step 7: Pre-Promotion Testing Gate

Before requesting deployment confirmation, verify the user has tested the workflow:

```text
PRE-PROMOTION CHECKLIST

Before promoting to PROD, confirm you have completed testing:

  1. Tested the DEV workflow end-to-end in n8n
  2. Verified all tool/sub-workflow integrations work correctly
  3. Checked error handling and edge cases

Have you completed testing in DEV? (yes/no)
```

**If "no" or unclear:** Do not proceed. Advise the user to test first and come back when ready.

**If "yes":** Continue to confirmation.

### Step 8: Request Confirmation

```text
PRODUCTION DEPLOYMENT

You are about to deploy to PRODUCTION.

This will:
1. Backup current PROD workflow
2. Apply the transformations shown above
3. Push to Support Agent

Type "confirm" to proceed, or anything else to cancel.
```

**Wait for explicit "confirm" response.**

### Step 9: Backup Current PROD

```
1. Pull current PROD workflow from n8n
2. Save to: {localPath}{logicalName}.backup.{timestamp}.json
   Example: agents/Support Agent.backup.2026-02-05T17-00-00.json
3. Log backup location
```

### Step 10: Perform Transformations

Run the deterministic transformation script:

```bash
node n8n-sdlc/scripts/transform.mjs \
  --direction promote \
  --workflow "{logicalName}" \
  --source "{devFilePath}" \
  --mappings n8n-sdlc/config/id-mappings.json \
  --config n8n-sdlc/config/project.json
```

Parse the JSON output:

- If `success` is `false`: show `errors` to user and **STOP**
- If `success` is `true`: use `workflow` from output for the MCP push
- Show `report` to user in the transformation report (name change, ID swap,
  references transformed, credentials mapped, fields stripped)

### Step 11: Push to PROD via MCP

```
MCP Tool: n8n_update_full_workflow
Parameters:
  - id: {PROD ID from mappings}
  - name: {transformed PROD workflow name}
  - nodes: {transformed nodes array}
  - connections: {connections object}
  - settings: {settings object}

IMPORTANT: If the PROD workflow is ACTIVE, this publishes immediately (goes live).
If this is a first-time promotion (PROD slot was inactive), the workflow will be
saved but NOT published. User must manually activate/publish in n8n UI.
```

### Step 12: Verify Promotion Success

```
1. Check MCP response for errors
2. Pull PROD workflow back from n8n
3. Verify key transformations were applied
4. Compare expected vs actual
```

### Step 13: Post-Promotion Validation

Run n8n's built-in validation on the promoted PROD workflow:

```
MCP Tool: n8n_validate_workflow
Parameters:
  - id: {PROD workflow ID}
  - options:
      profile: "strict"
      validateNodes: true
      validateConnections: true
      validateExpressions: true
```

Report the results:

**If valid with no errors:**

```
Post-promotion validation passed (0 errors, {N} warnings)
```

**If errors found:**

```
Post-promotion validation found issues:

Errors:
  {list errors}

Warnings:
  {list warnings}

The workflow was pushed but may have issues. Review the errors above.
Consider rolling back if critical errors are present.
```

### Step 14: Update Audit Trail

Update `n8n-sdlc/config/id-mappings.json`:

```json
{
  "Support Agent": {
    "type": "agent",
    "localPath": "agents/",
    "prod": {
      "id": "xyz789",
      "status": "active"
    },
    "audit": {
      "lastPromoted": "2026-02-05T17:00:00Z",
      "promotionCount": 1,
      "lastPromotionBackup": "agents/Support Agent.backup.2026-02-05T17-00-00.json"
    }
  }
}
```

### Step 15: Check Activation State

After pushing, check whether the PROD workflow was active or inactive:

**If PROD was already active (published):**

```
The PROD workflow was ACTIVE. The update has been PUBLISHED IMMEDIATELY.
Changes are now live. Please verify in n8n.
```

**If PROD was inactive (first-time promotion or unpublished):**

```
The PROD workflow is currently INACTIVE (not published).
The content has been saved but is NOT live yet.
To make it live, you must activate/publish it manually in the n8n UI.
```

### Step 16: Confirm Completion

```
PROMOTION SUCCESSFUL

Workflow: Support Agent
Source: DEV-Support Agent
Target: Support Agent

Transformations Applied:
- Workflow name: stripped devPrefix
- Workflow ID: transformed
- pinData stripped
- cachedResult metadata stripped
- 2 in-project tool references: transformed
- 1 external reference (unchanged)
- 1 credential mapping: transformed

Backup saved: agents/Support Agent.backup.2026-02-05T17-00-00.json

Please verify the workflow is working correctly in n8n.
Test key functionality before considering promotion complete.
```

## Dry-Run Mode

Support `--dry-run` flag to preview without executing:

```
User: "promote Support Agent --dry-run"

Response: Shows full transformation report WITHOUT pushing to PROD
```

## Error Handling

| Error | Resolution |
|-------|------------|
| PROD slot not reserved | Run n8n-sdlc-reserve-workflows first |
| Missing in-project PROD mapping | Reserve PROD slots for all referenced workflows first |
| Unmapped workflow reference | Add to workflows or externalDependencies in id-mappings.json |
| User didn't confirm | Operation cancelled; no changes made |
| MCP push failed | Retry or investigate; backup is safe |
| Transformation error | Log error; do not push partial result |

## Promotion Checklist

Before promoting, verify:

- [ ] DEV workflow is tested and working
- [ ] All referenced in-project workflows have PROD mappings
- [ ] External references are listed in externalDependencies
- [ ] PROD slot is reserved for this workflow
- [ ] Credential mappings exist (if different per env)
- [ ] User has confirmed the transformation report

## Rolling Back a Promotion

If promotion causes issues:

```
1. Locate backup file: {localPath}{workflowName}.backup.{timestamp}.json
   Example: agents/Support Agent.backup.2026-02-05T17-00-00.json
2. Use n8n-sdlc-push-workflow skill to push backup to PROD
3. Verify PROD is restored
```

### Step 17: Git Sync and PR Offer

Run the **n8n-sdlc-git-sync** skill with:

- Files: backup file and `n8n-sdlc/config/id-mappings.json`
- Message: `[promote] {workflow name} (v{promotionCount})`
- Example: `[promote] Support Agent (v3)`
- **PR mode**: After committing, the git-sync skill will offer to create a pull request from the dev branch to main. This keeps the main branch in sync with production.

## Related Skills

- **n8n-sdlc-validate-workflow** - Called automatically during promotion
- **n8n-sdlc-push-workflow** - Used internally to push transformed workflow
- **n8n-sdlc-pull-workflow** - Used to backup current PROD
- **n8n-sdlc-reserve-workflows** - Must run first to reserve PROD slots
- **n8n-sdlc-git-sync** - Called automatically after promotion to commit, push, and offer PR
