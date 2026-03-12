---
name: n8n-sdlc-doctor
description: Run comprehensive project diagnostics including config validation, MCP connectivity, registry integrity, drift detection, and slot hygiene. Use when user says "doctor", "diagnose", "health check", or "what's wrong".
---

Comprehensive project-wide health check that validates configuration, tests runtime
connectivity, and diagnoses common issues.

## When to Use

- Diagnosing setup or sync problems
- Verifying project health before a batch of promotions
- After onboarding to confirm everything is wired correctly
- User says "doctor", "diagnose", "health check", "what's wrong"

## Prerequisites

- `n8n-sdlc/config/project.json` should exist (doctor reports if missing)
- `n8n-sdlc/config/id-mappings.json` should exist (doctor reports if missing)
- n8n MCP server is optional (doctor degrades gracefully without it)

## Important Constraints

- **Doctor is read-only.** It never creates, updates, or deletes anything.
- **Doctor is project-scoped.** All MCP calls use the configured `n8nProjectId`.
- **Doctor reports problems and suggests fixes.** It does not auto-fix.

## Diagnostic Categories

Doctor runs eight categories of checks. Categories 2, 3, 4, 6, and 8
require MCP and are skipped when MCP is unavailable.

| # | Category | Requires MCP | Checks |
|---|----------|:---:|--------|
| 1 | Configuration Health | No | Config exists, schema valid, cross-file consistency |
| 2 | MCP Connectivity | Yes | Can reach n8n, project accessible |
| 3 | Registry Integrity | Yes | Mapped IDs exist in n8n, orphan detection |
| 4 | Naming Compliance | Yes | DEV/PROD naming conventions across all workflows |
| 5 | Local File Integrity | No | Workflow JSON files exist at expected paths |
| 6 | Drift Detection | Yes | Local audit vs remote versionId |
| 7 | Slot Hygiene | No | Stale slots, stuck statuses |
| 8 | Slot Creator | Yes | Webhook reachability (if configured) |

## Steps

### Step 1: Load Configuration

```text
Read n8n-sdlc/config/project.json and n8n-sdlc/config/id-mappings.json.

Store:
  projectId   = project.json -> n8nProjectId
  devPrefix   = project.json -> naming.devPrefix
  workflowsDir = project.json -> workflowsDir (default: "workflows/")
  workflows   = id-mappings.json -> workflows
  reservedSlots = id-mappings.json -> reservedSlots (may be absent)
  externalDeps  = id-mappings.json -> externalDependencies (may be absent)
  slotCreatorUrl = project.json -> slotCreator.webhookUrl (may be absent)

If either config file is missing, record the error and continue
with whatever checks are still possible.
```

### Step 2: Category 1 — Configuration Health

Run the same checks as validate-workflow Level 1. This is a reuse,
not a delegation — doctor performs the checks inline so the full
report stays in one place.

```text
Check 1.1: project.json exists
  Path: n8n-sdlc/config/project.json
  If missing: ❌ project.json not found. Run "get started" to initialize.

Check 1.2: project.json schema validation
  Read n8n-sdlc/config/project.schema.json.
  Validate project.json against it.
  Required fields: n8nProjectId (non-empty string), naming.devPrefix (string), version (string).
  If invalid: ❌ project.json schema violation: {detail}

Check 1.3: id-mappings.json exists
  Path: n8n-sdlc/config/id-mappings.json
  If missing: ❌ id-mappings.json not found. Run "get started" to create it.

Check 1.4: id-mappings.json schema validation
  Read n8n-sdlc/config/id-mappings.schema.json.
  Validate id-mappings.json against it.
  Required: workflows (object), metadata (projectName, createdAt, lastModified).
  Each workflow entry: type (agent|tool), localPath (string),
    dev (id + status), prod (id + status).
  Status enum: active, reserved, needs-slot, not-started.
  If invalid: ❌ id-mappings.json schema violation: {detail}

Check 1.5: Cross-file consistency
  a) metadata.projectName matches project.json projectName (if both set)
  b) All workflows with dev.status "active" have non-null dev.id
  c) All workflows with prod.status "active" have non-null prod.id
  d) No duplicate IDs across all dev.id values (excluding null)
  e) No duplicate IDs across all prod.id values (excluding null)
  f) No ID appears as both a dev.id and a prod.id of different workflows
  If any fail: ❌ Cross-file consistency error: {detail}
```

### Step 3: Category 2 — MCP Connectivity

```text
Call n8n_list_workflows with projectId.

If MCP call fails or times out:
  ⚠️ MCP unavailable — skipping runtime checks
     (Categories 2, 3, 4, 6, 8 will be skipped)
  Set mcpAvailable = false
  Continue with offline categories only.

If MCP call succeeds:
  Set mcpAvailable = true
  Store the returned workflow list as remoteWorkflows.
  ✓ Connected to n8n
  ✓ Project {projectId} accessible
  ✓ {count} workflows found in project

Verify project accessibility:
  If the response is empty or returns an error about invalid project:
  ❌ Project ID {projectId} not found or not accessible
  Fix: Verify n8nProjectId in project.json
```

### Step 4: Category 3 — Registry Integrity

Skip if mcpAvailable is false.

```text
Collect all known IDs from id-mappings:
  devIds  = all non-null dev.id values from workflows
  prodIds = all non-null prod.id values from workflows

Collect all remote IDs:
  remoteIds = all workflow IDs from remoteWorkflows

Check 3.1: DEV IDs exist in n8n
  For each devId: verify it appears in remoteIds.
  If missing: ❌ DEV ID {id} for "{workflowName}" not found in n8n
    The workflow may have been deleted from n8n.
    Fix: Re-reserve a DEV slot and update id-mappings.

Check 3.2: PROD IDs exist in n8n
  For each prodId: verify it appears in remoteIds.
  If missing: ❌ PROD ID {id} for "{workflowName}" not found in n8n
    Fix: Re-reserve a PROD slot and update id-mappings.

Check 3.3: Orphan detection
  For each remoteId: check if it appears in devIds, prodIds,
  reservedSlots, or externalDependencies.
  If not found in any:
    ⚠️ Orphan workflow in n8n: "{remoteName}" (id: {remoteId})
      This workflow is in the project but not tracked in id-mappings.
      Fix: Run "import project" to discover it, or add it manually.
```

### Step 5: Category 4 — Naming Compliance

Skip if mcpAvailable is false.

```text
For each remote workflow in remoteWorkflows:
  Determine if it is a DEV or PROD workflow by checking id-mappings:
    - If its ID matches a dev.id → it should be a DEV workflow
    - If its ID matches a prod.id → it should be a PROD workflow
    - If orphan → skip naming check (already flagged in Category 3)

Check 4.1: DEV workflows have prefix
  For each DEV workflow: verify name starts with devPrefix.
  If not: ⚠️ DEV workflow "{name}" (id: {id}) missing DEV prefix
    Expected: "{devPrefix}{baseName}"
    Fix: Rename in n8n or run push to correct the name.

Check 4.2: PROD workflows have no prefix
  For each PROD workflow: verify name does NOT start with devPrefix.
  If it does: ⚠️ PROD workflow "{name}" (id: {id}) has DEV prefix
    Expected: "{baseName}" (no prefix)
    Fix: Rename in n8n or check id-mappings for swapped IDs.

Check 4.3: id-mappings keys use PROD names
  For each key in id-mappings workflows:
    verify the key does NOT start with devPrefix.
  If it does: ❌ id-mappings key "{key}" has DEV prefix
    Keys must be PROD names (no prefix).
    Fix: Rename the key in id-mappings.json to the PROD name.
```

### Step 6: Category 5 — Local File Integrity

```text
For each workflow in id-mappings:
  Determine expected file paths based on workflowsDir, localPath,
  devPrefix, and workflow name (the id-mappings key = PROD name).

  DEV file: {workflowsDir}/{localPath}{devPrefix}{workflowName}.json
  PROD file: {workflowsDir}/{localPath}{workflowName}.json

Check 5.1: DEV file exists (if dev.status is "active")
  If missing: ⚠️ DEV file missing: {expectedPath}
    Fix: Run "pull {devPrefix}{workflowName}" to download it.

Check 5.2: PROD file exists (if prod.status is "active")
  If missing: ⚠️ PROD file missing: {expectedPath}
    Fix: Run "pull {workflowName}" to download it.

Note: Workflows with status "needs-slot", "not-started", or "reserved"
are not expected to have local files yet — skip them.
```

### Step 7: Category 6 — Drift Detection

Skip if mcpAvailable is false.

```text
For each workflow in id-mappings that has audit data:

Check 6.1: DEV drift
  If dev.id is non-null and audit.lastVersionId exists:
    Find the matching remote workflow by dev.id.
    Compare audit.lastVersionId to remote workflow's versionId.
    If different:
      ⚠️ DEV drift: "{devPrefix}{name}" remote has changed
        Local versionId: {auditVersion}
        Remote versionId: {remoteVersion}
        Fix: Run "pull {devPrefix}{name}" or "diff {name} dev"

Check 6.2: PROD drift
  If prod.id is non-null and audit.lastVersionId exists:
    Find the matching remote workflow by prod.id.
    Compare. (Note: PROD drift uses a separate audit field if available,
    or the same lastVersionId if the workflow was last touched via promote.)
    If different:
      ⚠️ PROD drift: "{name}" remote has changed
        Fix: Run "diff {name} prod" to review changes

Workflows without audit data are skipped with an info note:
  ℹ️ "{name}": no audit data — run push or pull to establish baseline.
```

### Step 8: Category 7 — Slot Hygiene

```text
Check 7.1: Stale reserved slots
  If reservedSlots exists and is non-empty:
    For each reserved slot ID:
      Check if this ID appears as any workflow's dev.id or prod.id.
      If yes: ⚠️ Stale reserved slot: {id} is already claimed by "{workflowName}"
        Fix: Remove it from reservedSlots in id-mappings.json.

Check 7.2: Workflows needing slots
  Count workflows where dev.status = "needs-slot" or prod.status = "needs-slot".
  If any:
    ⚠️ {count} workflow(s) need slots:
      - {name}: {env} needs slot
    Fix: Run "reserve workflows" to claim slots.

Check 7.3: Never-pushed reserved workflows
  Count workflows where status is "reserved" but audit has no lastPush.
  If any:
    ℹ️ {count} workflow(s) reserved but never pushed:
      - {name}: {env} slot reserved, awaiting first push
    This is informational — push when ready.
```

### Step 9: Category 8 — Slot Creator

Skip if mcpAvailable is false or slotCreatorUrl is not configured.

```text
If slotCreator.webhookUrl is not configured:
  ℹ️ Slot Creator not configured (optional).
  Skip this category.

If configured:
  The slot creator is an n8n webhook. To test reachability without
  triggering actual slot creation, simply note that the URL is configured.
  Do NOT call the webhook — doctor is read-only.

  ✓ Slot Creator configured: {webhookUrl}
  ℹ️ Reachability cannot be tested without triggering slot creation.
    If slot creation fails, check this URL manually.
```

### Step 10: Build Summary Report

```text
Compile all results into the output format below.

Count totals:
  passed   = number of ✓ checks
  warnings = number of ⚠️ checks
  errors   = number of ❌ checks
  skipped  = number of categories skipped (MCP unavailable)

Output:

═══════════════════════════════════════════════════════════════
                   DOCTOR: {ProjectName}
═══════════════════════════════════════════════════════════════

{Category 1 results}

{Category 2 results, or skip notice}

{Category 3 results, or skip notice}

{Category 4 results, or skip notice}

{Category 5 results}

{Category 6 results, or skip notice}

{Category 7 results}

{Category 8 results, or skip notice}

───────────────────────────────────────────────────────────────
SUMMARY: {passed} passed | {warnings} warnings | {errors} errors
{If skipped > 0: "({skipped} categories skipped — MCP unavailable)"}
───────────────────────────────────────────────────────────────

If errors > 0:
  ❌ Issues found. Fix errors above before running push or promote.

If errors = 0 and warnings > 0:
  ⚠️ Warnings found. Review above — these may need attention.

If errors = 0 and warnings = 0:
  ✅ All checks passed. Project is healthy.
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json missing | Report in Category 1, continue with partial checks |
| id-mappings.json missing | Report in Category 1, skip mapping-dependent checks |
| MCP unavailable | Report in Category 2, run offline checks only |
| Schema file missing | Report error, skip schema validation for that file |
| Individual workflow fetch fails | Report for that workflow, continue with others |

## MCP Commands Used

- `n8n_list_workflows` — List all workflows in project (pass `projectId`)

No other MCP commands are needed. Doctor uses only the list to cross-reference
IDs and names. It does not fetch individual workflows (keeping MCP calls minimal).

## Related Skills

- **n8n-sdlc-validate-workflow** — Per-workflow pre-flight checks (doctor reuses Level 1 logic)
- **n8n-sdlc-project-status** — Dashboard view (doctor adds diagnostic depth)
- **n8n-sdlc-reserve-workflows** — Fixes "needs-slot" issues found by doctor
- **n8n-sdlc-pull-workflow** — Fixes missing local files and drift
- **n8n-sdlc-diff-workflow** — Investigates drift warnings from doctor
- **n8n-sdlc-import-project** — Resolves orphan workflows found by doctor
