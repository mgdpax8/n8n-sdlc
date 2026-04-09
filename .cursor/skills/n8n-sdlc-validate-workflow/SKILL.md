---
name: n8n-sdlc-validate-workflow
description: Run pre-flight validation checks for n8n SDLC operations including config, naming, mapping, and reference validation. Called automatically by push and promote skills. Use when user says "validate", "check workflow", or "verify setup".
---

Pre-flight validation checks for n8n SDLC operations.

## When to Use

- **Automatically called** by n8n-sdlc-push-workflow and n8n-sdlc-promote-workflow skills
- Manually run to check project/workflow status
- User says "validate", "check workflow", "verify setup"

## Purpose

Ensures all prerequisites are met before performing operations that could affect n8n workflows. Returns a pass/fail result with detailed error messages.

## Validation Levels

| Level | When Used | Checks Performed |
|-------|-----------|------------------|
| **Config** | All operations | Config files exist, pass schema validation, cross-file consistency |
| **Naming** | Push, Promote | Workflow name follows convention |
| **Mapping** | Push, Promote | Workflow ID exists in mappings |
| **References** | Promote only | All workflowId refs have target env mappings |

## Validation Checks

Run the deterministic validation script:

```bash
node n8n-sdlc/scripts/validate-config.mjs \
  --config n8n-sdlc/config/project.json \
  --mappings n8n-sdlc/config/id-mappings.json \
  --level {level} \
  [--workflow "{workflowFilePath}"] \
  [--direction promote|seed]
```

**Levels** (each includes all checks from previous levels):

- `config-only` — Checks 1.1–1.7: file existence, required fields, structural
  validation against schemas, cross-file consistency (project name match,
  active-status-has-ID, no duplicate IDs)
- `naming` — + Checks 2.1–2.2: workflow name follows DEV/PROD convention,
  environment determination. Requires `--workflow`.
- `mapping` — + Checks 3.1–3.4: workflow exists in mappings, localPath valid,
  target environment ID exists, no duplicate IDs. Requires `--workflow`.
- `full` — + Checks 4.1–4.2: all workflowId references have target-env
  mappings, credential mappings complete. Requires `--workflow` and `--direction`.

Parse the JSON output:

- `valid`: `true` if zero failures
- `checks`: array of `{id, name, status, message?}` — one entry per check
- `summary`: `{pass, warn, fail}` counts

**Check 1.4 (project ownership)** is still performed by the AI during
push/promote when fetching from n8n via MCP — the script cannot call MCP.
Compare `data.shared[0].projectId` to `n8nProjectId` after any `n8n_get_workflow`
call with `mode: "full"`.

**Check 3.2 (localPath file existence)** includes self-healing that requires
filesystem search — the AI should still handle the "search workspace for file"
fallback if the script reports localPath as invalid.

Display the results to the user, showing failures and warnings with fix suggestions.

## Output Format

### Validation Passed

```
✅ VALIDATION PASSED

Workflow: DEV-Support Agent
Environment: Development
Target ID: abc123

All checks passed:
  ✓ project.json exists and valid
  ✓ project.json structural validation passed
  ✓ id-mappings.json exists
  ✓ id-mappings.json structural validation passed
  ✓ Cross-file consistency checks passed
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
     Fix: Run "n8n-sdlc-reserve-workflows" to add this workflow

  2. ❌ Referenced workflow "List Invoices" has no PROD mapping
     Fix: Reserve PROD slot for "List Invoices" before promoting

Warnings (1):
  ⚠️ Credential "slack" referenced but not in credential mappings
     This may be intentional if the credential is the same in both environments

Operation blocked. Fix errors before proceeding.
```

## How Other Skills Use Validation

### n8n-sdlc-push-workflow

```
1. Call validate with level: "mapping"
2. If validation fails, stop and show errors
3. If passes, proceed with push
```

### n8n-sdlc-promote-workflow

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
| project.json structural validation | 1 | All operations |
| id-mappings.json exists | 1 | Push, Promote |
| id-mappings.json structural validation | 1 | Push, Promote |
| Cross-file consistency | 1 | Push, Promote |
| Name follows convention | 2 | Push, Promote |
| Environment determination | 2 | Push, Promote |
| Workflow in mappings | 3 | Push, Promote |
| localPath valid and file exists | 3 | Push, Promote |
| Target ID not null | 3 | Push, Promote |
| No duplicate IDs | 3 | Push, Promote |
| All refs have PROD IDs (in-project only) | 4 | Promote only |
| Credential mappings exist | 4 | Promote only |

## Related Skills

- **n8n-sdlc-push-workflow** - Calls validation before push
- **n8n-sdlc-promote-workflow** - Calls validation before promote
- **n8n-sdlc-getting-started** - The setup wizard; creates required config files
- **n8n-sdlc-reserve-workflows** - Adds workflows to mappings
