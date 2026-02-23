# n8n MCP Behavior Test Plan

This document outlines tests to verify n8n MCP behavior before relying on it for production workflows.

## Test Status

| Test | Status | Result | Date |
|------|--------|--------|------|
| Update publishes immediately? | NOT TESTED | - | - |
| Can filter by folder? | NOT TESTED | - | - |
| Creation date available? | NOT TESTED | - | - |
| Workflow listing complete? | NOT TESTED | - | - |

## Prerequisites

- [ ] n8n MCP server is enabled in Cursor
- [ ] At least one test workflow exists in n8n
- [ ] Test workflow is in a known folder (not Personal)

---

## Test 1: Does Update Publish Immediately?

**Question:** When we update a workflow via MCP, does it immediately go live, or does it create a draft/unpublished version?

**Why It Matters:** If updates create drafts, users would need to manually publish in n8n UI, adding an extra step.

### Test Procedure

1. Create a simple test workflow in n8n UI
2. Note its current state (active or inactive)
3. Add a distinctive node (e.g., a sticky note with "MCP TEST")
4. Use MCP to update the workflow with the new node
5. Check in n8n UI:
   - Is the new node visible?
   - Did the workflow's "modified" timestamp update?
   - Is there a "draft" indicator or version difference?

### Expected Outcomes

| Scenario | What We See | Implication |
|----------|-------------|-------------|
| Immediate publish | New node visible immediately | MCP updates are live instantly |
| Creates draft | "Unpublished changes" indicator | Need manual publish step |
| Creates version | Version number incremented | n8n has version history |

### Test Result

```
Date: _______________
Tester: _______________
MCP Version: _______________
n8n Version: _______________

Result:
[ ] Immediate publish - updates are live
[ ] Creates draft - requires manual publish
[ ] Other: _______________________________

Notes:
_________________________________________
_________________________________________
```

---

## Test 2: Can We Filter Workflows by Folder?

**Question:** Does the MCP `list_workflows` command support filtering by folder/project?

**Why It Matters:** If we can filter, we only see relevant workflows. If not, we must pull all and filter locally.

### Test Procedure

1. Note the folder name where test workflows exist
2. Call MCP `list_workflows` with folder filter (if supported)
3. Check if only folder workflows returned
4. If no filter option, call without filter and check response structure

### Expected Outcomes

| Scenario | What We See | Implication |
|----------|-------------|-------------|
| Filter supported | Only folder workflows returned | Cleaner, faster queries |
| No filter | All workflows returned | Must filter locally |
| Folder info in response | Each workflow has folder metadata | Can filter locally by folder |

### Test Result

```
Date: _______________

Result:
[ ] Filter supported - parameter: _______________
[ ] No filter - must get all workflows
[ ] Folder info available in response - field name: _______________

Notes:
_________________________________________
```

---

## Test 3: Is Creation Date Available?

**Question:** When listing workflows, can we see when each was created?

**Why It Matters:** The "reserve-workflows" skill needs to identify the newest workflows (just created by user).

### Test Procedure

1. Call MCP `list_workflows`
2. Examine response structure for each workflow
3. Look for: `createdAt`, `created`, `dateCreated`, or similar

### Expected Outcomes

| Scenario | What We See | Implication |
|----------|-------------|-------------|
| createdAt available | Timestamp field in response | Can sort by creation date |
| Only updatedAt | Only modification time | Use modification time as proxy |
| No dates | No timestamp fields | Need alternate identification method |

### Test Result

```
Date: _______________

Result:
[ ] createdAt field available
[ ] Only updatedAt available
[ ] No timestamp fields
[ ] Other: _______________

Field name if found: _______________

Notes:
_________________________________________
```

---

## Test 4: Workflow Listing Completeness

**Question:** Does `list_workflows` return all fields we need?

**Why It Matters:** We need workflow ID, name, and ideally folder info to work properly.

### Test Procedure

1. Call MCP `list_workflows`
2. Document all fields returned for each workflow
3. Verify essential fields are present

### Essential Fields Checklist

| Field | Present? | Field Name in Response |
|-------|----------|------------------------|
| Workflow ID | | |
| Workflow Name | | |
| Active/Inactive Status | | |
| Folder/Project | | |
| Created Date | | |
| Modified Date | | |
| Tags | | |

### Test Result

```
Date: _______________

Sample Response (one workflow):
{
  // Paste actual response here
}

Notes:
_________________________________________
```

---

## Test 5: Update Workflow Behavior

**Question:** What happens when we call `update_workflow`?

### Test Procedure

1. Get current workflow state via MCP
2. Make a small change (e.g., add sticky note)
3. Update via MCP
4. Get workflow again to compare

### Verify

- [ ] Name can be changed
- [ ] Nodes can be added
- [ ] Nodes can be removed
- [ ] Connections are preserved
- [ ] Settings are preserved
- [ ] Credentials are preserved

### Test Result

```
Date: _______________

All updates successful: [ ] Yes [ ] No

Issues found:
_________________________________________
```

---

## Summary and Recommendations

After completing all tests, document findings here:

```
Date: _______________
MCP Version: _______________
n8n Version: _______________

Key Findings:
1. Update behavior: _______________________________
2. Folder filtering: _______________________________
3. Date availability: _______________________________
4. Listing completeness: _______________________________

Recommended Adjustments to SDLC System:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________
```

---

## How to Run Tests

Once MCP is enabled:

1. Say "Let's test the n8n MCP behavior"
2. Work through each test above
3. Document results in this file
4. Adjust skills if needed based on findings
