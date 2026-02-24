# n8n MCP Behavior Test Plan

This document outlines tests to verify n8n MCP behavior before relying on it for production workflows.

## Test Status

| Test | Status | Result | Date |
|------|--------|--------|------|
| Update publishes immediately? | TESTED | Depends on state: active=publishes immediately; inactive=save only | 2026-02-23 |
| Can filter by project? | TESTED | YES - `projectId` works (enterprise) | 2026-02-23 |
| Can filter by folder? | TESTED | NO - MCP has zero folder awareness | 2026-02-23 |
| Creation date available? | TESTED | YES - `createdAt` in both list and get | 2026-02-23 |
| Workflow listing complete? | TESTED | YES - rich field set (see details) | 2026-02-23 |
| Update workflow behavior? | TESTED | YES - nodes add/remove, connections/creds preserved | 2026-02-23 |
| Folder metadata in get_workflow? | TESTED | NO - not returned even for workflows in folders | 2026-02-23 |
| n8n_validate_workflow works? | TESTED | YES - returns errors, warnings, suggestions | 2026-02-23 |

## Prerequisites

- [x] n8n MCP server is enabled in Cursor
- [x] At least one test workflow exists in n8n
- [x] Test workflow is in a known folder (not Personal)

## Test Environment

| Component | Value |
|-----------|-------|
| n8n Instance | https://n8n.tech.pax8.com |
| n8n Version | 2.35.5 |
| MCP Package | n8n-mcp (via npx) |
| Node.js | v24.13.1 |
| Test Workflow | `YQ32G5NXBOQI0Aslp2ftu` ("Main workflow") |
| Test Project | `6qXiER8SWdBL3Cjs` ("n8n SDLC Testing") |
| Test Folder | `l6mxj3pKLsbrRAp7` (within test project) |
| Tester | Cursor AI Agent |
| Date | 2026-02-23 |

---

## CRITICAL FINDING: MCP Updates Publish Immediately on Active Workflows

**MCP behavior depends on the workflow's active/published state:**

| Workflow State | MCP Update Behavior | versionCounter Change |
|----------------|---------------------|-----------------------|
| **Active (published)** | Saves AND publishes immediately -- new published version goes live | +5 (multiple internal steps) |
| **Inactive (unpublished)** | Saves only -- like autosave, no publish | +1 |

This was confirmed by running the same test (add sticky note) on the same workflow in both states.

**Key difference from n8n UI behavior:** When editing on the n8n canvas, changes autosave but do NOT publish -- you must explicitly click "Publish." MCP updates bypass this and publish directly if the workflow is active.

**Impact on SDLC System:**
- **PROD workflows (active):** MCP push/promote publishes immediately to live. There is no draft/review stage. The change is live the instant the MCP call completes.
- **DEV workflows (inactive):** MCP push saves changes but does not publish. Safe for development iteration.
- **First-time PROD promotions:** The PROD slot starts inactive. After MCP push, the workflow will be saved but NOT published. The user must manually activate/publish in the n8n UI.

**Required SDLC Adjustments:**
1. Document that MCP updates to active workflows are immediately live (no draft step)
2. For promote skill: after pushing to a previously-inactive PROD slot, remind user to activate/publish manually in n8n UI
3. For push skill: if pushing to an active PROD workflow, warn that changes go live immediately
4. Consider pulling the current state and checking `active` before any push to surface the right warning

---

## Test 1: Does Update Publish Immediately?

**Question:** When we update a workflow via MCP, does it immediately go live, or does it create a draft/unpublished version?

**Why It Matters:** If updates create drafts, users would need to manually publish in n8n UI, adding an extra step.

### Test Result

```
Date: 2026-02-23
Tester: Cursor AI Agent
MCP Version: n8n-mcp (latest via npx)
n8n Version: 2.35.5

Test A: Update an ACTIVE (published) workflow
- Used n8n_update_partial_workflow to add a sticky note node
- Re-fetched immediately; sticky note was present
- active: remained true
- activeVersionId: set to new versionId (was null)
- activeVersion: populated with full workflow data + workflowPublishHistory
- versionCounter: 25 -> 30 (+5, multiple internal steps for publish)
- workflowPublishHistory showed deactivated+activated events
- RESULT: MCP update PUBLISHED immediately to the live version

Test B: Update an INACTIVE (unpublished) workflow
- Same test: added sticky note via n8n_update_partial_workflow
- Re-fetched immediately; sticky note was present
- active: remained false
- activeVersionId: remained null (no published version)
- activeVersion: remained null
- versionCounter: 34 -> 35 (+1, simple save)
- RESULT: MCP update SAVED only (like autosave), did NOT publish

Conclusion:
[x] Active workflows: immediate publish - changes are live instantly
[x] Inactive workflows: save only - like autosave, no publish
[ ] Creates draft - MCP does not create drafts (either publishes or saves)

Key insight: n8n canvas autosave does NOT publish; MCP updates DO publish
if the workflow is active. This is a critical behavioral difference.
```

---

## Test 2: Can We Filter Workflows by Folder/Project?

**Question:** Does the MCP `n8n_list_workflows` command support filtering by folder/project?

**Why It Matters:** If we can filter, we only see relevant workflows. If not, we must pull all and filter locally.

### Test Result

```
Date: 2026-02-23

Result:
[x] Project filter supported - parameter: projectId (enterprise feature)
[x] No folder filter - MCP has no folder awareness at all
[ ] Folder info available in response - NOT AVAILABLE

Notes:
- n8n_list_workflows(projectId: "6qXiER8SWdBL3Cjs") returned 9 workflows (correct)
- n8n_list_workflows(limit: 5) without projectId returned workflows from all projects
- No folder parameter exists on any MCP tool
- n8n_get_workflow(mode: "full") does NOT return folder metadata
- The test workflow is in folder l6mxj3pKLsbrRAp7 but this ID appears nowhere in MCP responses
- Project-level scoping is the finest granularity available
```

---

## Test 3: Is Creation Date Available?

**Question:** When listing workflows, can we see when each was created?

**Why It Matters:** The "n8n-sdlc-reserve-workflows" skill needs to identify the newest workflows (just created by user).

### Test Result

```
Date: 2026-02-23

Result:
[x] createdAt field available
[x] updatedAt also available
[ ] No timestamp fields

Field names: createdAt, updatedAt (ISO 8601 format)

Notes:
- Both fields present in n8n_list_workflows response
- Both fields present in n8n_get_workflow response
- Example: "createdAt": "2026-02-23T16:56:24.530Z"
- Can sort by createdAt to find most recently created workflows (useful for n8n-sdlc-reserve-workflows skill)
```

---

## Test 4: Workflow Listing Completeness

**Question:** Does `n8n_list_workflows` return all fields we need?

**Why It Matters:** We need workflow ID, name, and ideally folder info to work properly.

### Essential Fields Checklist

| Field | Present? | Field Name in Response |
|-------|----------|------------------------|
| Workflow ID | YES | `id` |
| Workflow Name | YES | `name` |
| Active/Inactive Status | YES | `active` |
| Archived Status | YES | `isArchived` (new discovery) |
| Folder/Project | NO | Not available in list; `shared[0].projectId` in get only |
| Created Date | YES | `createdAt` |
| Modified Date | YES | `updatedAt` |
| Tags | YES | `tags` (array) |
| Node Count | YES | `nodeCount` (new discovery - useful for finding empty slots) |

### n8n_get_workflow (mode=full) Additional Fields

| Field | Present? | Useful For |
|-------|----------|------------|
| `versionId` | YES | Optimistic locking / drift detection |
| `versionCounter` | YES | Total edit count |
| `shared[0].projectId` | YES | Project scoping verification |
| `shared[0].project.name` | YES | Human-readable project name |
| `shared[0].project.type` | YES | "team" for enterprise projects |
| `pinData` | YES | Must be stripped during promotion |
| `activeVersionId` | YES | Version tracking |
| `activeVersion` | YES | Full active version data (when active) |
| `triggerCount` | YES | Number of triggers |
| `settings.callerPolicy` | YES | Workflow caller restrictions |

### Test Result

```
Date: 2026-02-23

Sample n8n_list_workflows response (one workflow):
{
  "id": "YQ32G5NXBOQI0Aslp2ftu",
  "name": "Main workflow",
  "active": false,
  "isArchived": false,
  "createdAt": "2026-02-06T22:24:01.652Z",
  "updatedAt": "2026-02-23T19:47:55.947Z",
  "tags": [],
  "nodeCount": 4
}

Notes:
- nodeCount is valuable for identifying empty workflow slots (nodeCount 0 or 1)
- isArchived is a new field not previously documented
- Pagination works: hasMore + nextCursor for sets > limit
- No folder/project info in list response (only available via get_workflow)
```

---

## Test 5: Update Workflow Behavior

**Question:** What happens when we call `n8n_update_partial_workflow`?

### Test Procedure

1. Got current workflow state: 4 nodes, inactive, versionId `784c01e4-...`
2. Added sticky note via `n8n_update_partial_workflow` (addNode operation)
3. Re-fetched: sticky note present, 5 nodes, versionId changed to `ef8b66bc-...`
4. Removed sticky note via `n8n_update_partial_workflow` (removeNode operation)
5. Re-fetched: back to 4 nodes, sticky note gone

### Verify

- [ ] Name can be changed (not tested - use `updateName` operation or `n8n_update_full_workflow`)
- [x] Nodes can be added (addNode operation works)
- [x] Nodes can be removed (removeNode operation works)
- [x] Connections are preserved (all original connections intact after add/remove)
- [x] Settings are preserved (executionOrder, binaryMode preserved; callerPolicy was added)
- [x] Credentials are preserved (Azure OpenAI and MongoDB credentials intact)

### Test Result

```
Date: 2026-02-23

All updates successful: [x] Yes [ ] No

Findings:
1. Active workflows: update publishes immediately (versionCounter +5, activeVersionId set)
2. Inactive workflows: update saves only (versionCounter +1, activeVersionId stays null)
3. MCP does NOT change the active/inactive state -- workflow stays as it was
4. settings.callerPolicy appeared after first update ("workflowsFromSameOwner") - n8n default
5. No way to activate/deactivate via MCP (no active parameter on update tools)
6. First-time PROD promotions (inactive slot) will require manual publish in n8n UI
```

---

## Test 6: Folder Metadata in get_workflow

**Question:** Does `n8n_get_workflow` return any folder metadata for workflows inside folders?

**Why It Matters:** If folder info is available, we could verify workflows are in the correct folder during the Reserve-and-Claim process.

### Test Result

```
Date: 2026-02-23

Test workflow: YQ32G5NXBOQI0Aslp2ftu (in folder l6mxj3pKLsbrRAp7)

Result: NO folder metadata returned

The n8n_get_workflow response includes:
- shared[0].projectId: "6qXiER8SWdBL3Cjs" (project level only)
- shared[0].project.name: "n8n SDLC Testing"
- shared[0].project.type: "team"
- NO folderId, folderName, folderPath, or any folder reference

Conclusion: MCP is completely blind to folders. The Reserve-and-Claim pattern
cannot programmatically verify folder placement. Users MUST manually ensure
workflows are created in the correct folder.
```

---

## Test 7: n8n_validate_workflow

**Question:** Does the MCP validation tool provide useful pre/post-deployment checks?

### Test Result

```
Date: 2026-02-23

Tool: n8n_validate_workflow with profile "strict"
Workflow: YQ32G5NXBOQI0Aslp2ftu

Result: valid=true, 0 errors, 7 warnings

Warnings returned:
1. Workflow-level: "Consider adding error handling"
2. Azure OpenAI node: no error handling configured
3. MongoDB node: database operation without error handling
4. AI Agent: no tools connected
5. Chat Trigger: should use streaming responseMode
6. AI Agent: no systemMessage defined
7. AI Agent: no ai_tool connections

Conclusion: Useful for post-promotion validation. The "strict" profile catches
quality issues that wouldn't break the workflow but could cause problems in production.
Should be integrated into the n8n-sdlc-promote-workflow skill as a post-push check.
```

---

## Summary and Recommendations

```
Date: 2026-02-23
MCP Version: n8n-mcp (latest via npx)
n8n Version: 2.35.5

Key Findings:
1. Update behavior: Active workflows = immediate publish; Inactive = save only (no publish).
   MCP does NOT change active/inactive state. Unlike n8n UI canvas (autosave without publish),
   MCP updates to active workflows publish immediately.
2. Project filtering: Works via projectId (enterprise). No folder awareness at all.
3. Date availability: createdAt and updatedAt both available in list and get.
4. Listing completeness: Rich field set including nodeCount, isArchived, tags.
5. Version tracking: versionId changes on every save (enables optimistic locking).
6. Validation: n8n_validate_workflow works well with strict profile.
7. Folder blindness: No folder metadata in any MCP response.
8. Activation control: MCP cannot activate or deactivate workflows (no active parameter).
   First-time PROD promotions require manual activation in n8n UI.

Recommended Adjustments to SDLC System:
1. Push/promote to ACTIVE workflows: warn that changes go live immediately (no draft).
2. First-time PROD promotion (inactive slot): remind user to manually activate in n8n UI.
3. Use nodeCount from n8n_list_workflows to identify empty slots during reservation
   (nodeCount of 0 or 1 indicates an empty/minimal workflow).
4. Use versionId comparison before push to detect remote drift (optimistic locking).
5. Add n8n_validate_workflow (profile: strict) as post-promotion verification.
6. Document that folder placement cannot be verified via MCP - users must ensure
   correct folder manually during the Reserve-and-Claim process.
7. Use isArchived field to filter out archived workflows during listing.
8. Consider adding activation state check before push to surface appropriate warnings.
```

---

## How to Run Tests

These tests were executed on 2026-02-23 using Cursor AI Agent with the n8n MCP server.

To re-run or verify:
1. Ensure n8n MCP server is enabled in Cursor
2. Have a test workflow ID ready (non-critical, in a project folder)
3. Run the MCP calls as documented above
4. Compare results with these findings -- behavior may change with MCP or n8n version updates
