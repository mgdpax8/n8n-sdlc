# Skill: Validate Workflow

Pre-flight validation checks for n8n SDLC operations.

## When to Use

- **Automatically called** by push-workflow and promote-workflow skills
- Manually run to check project/workflow status
- User says "validate", "check workflow", "verify setup"

## Purpose

Ensures all prerequisites are met before performing operations that could affect n8n workflows. Returns a pass/fail result with detailed error messages.

## Validation Levels

| Level | When Used | Checks Performed |
|-------|-----------|------------------|
| **Config** | All operations | project.json, id-mappings.json exist |
| **Naming** | Push, Promote | Workflow name follows convention |
| **Mapping** | Push, Promote | Workflow ID exists in mappings |
| **References** | Promote only | All workflowId refs have target env mappings |

## Validation Checks

### Level 1: Configuration Validation

**Check 1.1: project.json exists**
```
Path: config/project.json
Required: Yes

If missing:
  ❌ FAIL: config/project.json not found
  Fix: Run the "getting-started" skill to initialize the project
```

**Check 1.2: project.json is valid**
```
Required fields:
- projectName (non-empty string)
- n8nFolder (non-empty string)
- n8nProjectId (non-empty string; from workflow URL projectId=...; locks MCP to this project)
- naming.devPrefix (typically "DEV-"; from config/project.json)

If invalid:
  ❌ FAIL: project.json missing required field: {fieldName}
  Fix: Add the missing field to config/project.json
```

**Check 1.3: id-mappings.json exists (for push/promote)**
```
Path: config/id-mappings.json
Required: For push and promote operations

If missing:
  ❌ FAIL: config/id-mappings.json not found
  Fix: Run the "getting-started" skill to create the file
```

**Check 1.4: Workflow in configured project (when validating workflow from n8n)**
```
When the workflow was fetched from n8n (n8n_get_workflow with mode: "full"):
Compare data.shared[0].projectId to config/project.json n8nProjectId.

If they do not match:
  ❌ FAIL: Workflow is not in the configured project
  The workflow belongs to a different n8n project. Only workflows in the locked project (n8nProjectId) may be used.
  Fix: Use a workflow from the correct project, or update n8nProjectId in project.json if you intend to use this project.
```

### Level 2: Naming Convention Validation

**Check 2.1: Workflow name follows pattern**
```
Expected pattern:
- DEV: name starts with devPrefix (from config/project.json naming.devPrefix, typically "DEV-")
- PROD: plain name with no prefix

Examples (with devPrefix "DEV-"):
  ✓ DEV-Support Agent
  ✓ DEV-List Invoices
  ✓ Support Agent
  ✓ List Invoices
  ✗ DEVSupport Agent (missing hyphen after DEV)
  ✗ dev-Support Agent (wrong case; must match devPrefix exactly)

Logical name extraction (for id-mappings lookup):
- If name starts with devPrefix: logicalName = name.slice(devPrefix.length)
- Else: logicalName = name

If invalid:
  ❌ FAIL: Workflow name "{name}" does not follow convention
  Expected: DEV workflows start with "{devPrefix}", PROD workflows use plain name
  Fix: Rename workflow to follow the pattern
```

**Check 2.2: Environment determination**
```
- Name starts with devPrefix (e.g., "DEV-") → Development environment
- Otherwise → Production environment

No "unknown prefix" error. All names are either dev or prod.
```

### Level 3: ID Mapping Validation

**Check 3.1: Workflow exists in mappings**
```
Extract logical name from full workflow name:
- If name starts with devPrefix: logicalName = name.slice(devPrefix.length)
- Else: logicalName = name

Look up logicalName in id-mappings.json workflows

If not found:
  ❌ FAIL: Workflow "{logicalName}" not found in id-mappings.json
  Fix: Run "reserve-workflows" to add this workflow
```

**Check 3.2: localPath validation**
```
For the workflow's id-mappings entry:
1. Verify localPath exists and is a non-empty string
2. Verify the localPath folder exists on disk (e.g., agents/, tools/)
3. Verify the workflow JSON file exists at {localPath}/{workflowName}.json

Self-healing: If file not found at expected localPath, search workspace for {workflowName}.json
- If found elsewhere, suggest updating localPath in id-mappings
- If not found anywhere, fail

If localPath missing or invalid:
  ❌ FAIL: Workflow "{logicalName}" has invalid localPath
  localPath: {localPath}
  Fix: Update localPath in id-mappings.json to the correct folder

If folder or file not found:
  ❌ FAIL: Workflow file not found for "{logicalName}"
  Expected: {localPath}/{workflowName}.json
  Fix: Ensure the workflow JSON exists at the expected path, or run pull-workflow
```

**Check 3.3: Target environment ID exists**
```
For push to DEV: Check dev.id is not null
For push to PROD: Check prod.id is not null

If null:
  ❌ FAIL: No {env} ID mapped for "{logicalName}"
  Current status: {status}
  Fix: Run "reserve-workflows" to reserve a {env} slot
```

**Check 3.4: No duplicate IDs**
```
Scan all mappings for duplicate IDs
Each n8n ID should appear only once

If duplicate:
  ❌ FAIL: Duplicate ID found: {id}
  Used by: {workflow1}, {workflow2}
  Fix: Resolve the duplicate in id-mappings.json
```

### Level 4: Reference Validation (Promote Only)

**Check 4.1: All workflow references have target mappings**
```
Scan workflow for:
- @n8n/n8n-nodes-langchain.toolWorkflow nodes
- n8n-nodes-base.executeWorkflow nodes

For each workflowId found:
1. Check if workflowId is in id-mappings workflows (by dev.id)
   - If yes: verify prod.id is not null (in-project ref needs prod mapping for promotion)
2. Check if workflowId is in externalDependencies
   - If yes: no prod mapping needed (external deps are left as-is during promotion)
3. If in neither: fail (unknown reference)

External dependencies don't need prod mappings—they use the same ID in both environments.

If any in-project reference unmapped:
  ❌ FAIL: Unmapped workflow reference found
  
  | Node Name      | DEV ID      | PROD ID |
  |----------------|-------------|---------|
  | List Invoices  | abc123      | NULL ❌ |
  
  Fix: Run "reserve-workflows" to reserve PROD slots for missing workflows
```

**Check 4.2: All credential mappings exist (if needed)**
```
Scan workflow for credential references
Check if any credentials are in project.json credential mappings

For mapped credentials, verify both dev and prod IDs exist

If missing:
  ⚠️ WARNING: Credential "{name}" referenced but not in mappings
  This credential will not be transformed during promotion
  Fix: Add credential mapping to project.json if it differs between environments
```

## Output Format

### Validation Passed
```
✅ VALIDATION PASSED

Workflow: DEV-Support Agent
Environment: Development
Target ID: abc123

All checks passed:
  ✓ project.json exists and valid
  ✓ id-mappings.json exists
  ✓ Naming convention correct
  ✓ Workflow mapped with valid ID
  ✓ localPath valid and file exists

Ready for operation.
```

### Validation Failed
```
❌ VALIDATION FAILED

Workflow: DEV-Support Agent
Environment: Development

Errors found (2):
  1. ❌ Workflow "Support Agent" not found in id-mappings.json
     Fix: Run "reserve-workflows" to add this workflow

  2. ❌ Referenced workflow "List Invoices" has no PROD mapping
     Fix: Reserve PROD slot for "List Invoices" before promoting

Warnings (1):
  ⚠️ Credential "slack" referenced but not in credential mappings
     This may be intentional if the credential is the same in both environments

Operation blocked. Fix errors before proceeding.
```

## How Other Skills Use Validation

### push-workflow.md
```
1. Call validate with level: "mapping"
2. If validation fails, stop and show errors
3. If passes, proceed with push
```

### promote-workflow.md
```
1. Call validate with level: "references"
2. If validation fails, stop and show errors
3. If passes, proceed with promotion
```

## Manual Validation Commands

Users can request validation directly:

```
User: "validate project"
→ Run Level 1 checks only

User: "validate DEV-Support Agent"
→ Run Levels 1-3 for the specified workflow

User: "validate for promotion Support Agent"
→ Run Levels 1-4 to check if ready for promotion
```

## Validation Check Summary

| Check | Level | Required For |
|-------|-------|--------------|
| project.json exists | 1 | All operations |
| project.json valid | 1 | All operations |
| id-mappings.json exists | 1 | Push, Promote |
| Name follows convention | 2 | Push, Promote |
| Environment determination | 2 | Push, Promote |
| Workflow in mappings | 3 | Push, Promote |
| localPath valid and file exists | 3 | Push, Promote |
| Target ID not null | 3 | Push, Promote |
| No duplicate IDs | 3 | Push, Promote |
| All refs have PROD IDs (in-project only) | 4 | Promote only |
| Credential mappings exist | 4 | Promote only |

## Related Skills

- `push-workflow.md` - Calls validation before push
- `promote-workflow.md` - Calls validation before promote
- `n8n-getting-started.md` - Creates required config files
- `reserve-workflows.md` - Adds workflows to mappings
