# Pilot Guide: Billing Bot

This guide walks through using the n8n SDLC system with the Billing Bot project as a pilot.

## Prerequisites

Before starting:
- [ ] n8n MCP server enabled in Cursor
- [ ] Access to n8n instance with Billing Bot workflows
- [ ] MCP behavior tested (see `MCP-Test-Plan.md`)

## Current State

The Billing Bot project has example workflows in `example/`:

```
example/
├── agents/
│   ├── Billing Bot MVP.json
│   └── Invoice Agent.json
└── tools/
    ├── Get Invoice Totals.json
    ├── Get Totals by Company by Product.json
    ├── Get Totals by Company.json
    ├── Get Totals by Vendor.json
    └── List Invoices.json
```

These are the EXISTING workflows. The pilot will:
1. Initialize the SDLC system for Billing Bot
2. Register existing workflow IDs
3. Set up dev/prod slots
4. Test the promotion process

---

## Phase 1: Initialize Project

### Step 1.1: Run Getting Started

```
User: "Set up n8n project for Billing Bot"
```

**Provide:**
- Project Name: `BillingBot`
- n8n Folder Name: [Your actual n8n folder name, e.g., "AITO - Billing Bot"]

**Result:** Creates `config/project.json` and `config/id-mappings.json`

### Step 1.2: Verify Configuration

Check that `config/project.json` looks correct:

```json
{
  "projectName": "BillingBot",
  "n8nFolder": "AITO - Billing Bot",
  "naming": {
    "devPrefix": "DEV-",
    "prodPrefix": "PROD-",
    "separator": "-"
  }
}
```

---

## Phase 2: Register Existing Workflows

The existing workflows need to be imported into the SDLC system.

### Step 2.1: List Existing Workflows

Identify the n8n IDs for each existing workflow. From the example files:

| Workflow | Type | Example File | n8n ID |
|----------|------|--------------|--------|
| Invoice Agent | Agent | `example/agents/Invoice Agent.json` | `YbM4pqxRD0AnOVhb` |
| Billing Bot MVP | Agent | `example/agents/Billing Bot MVP.json` | [Check file] |
| List Invoices | Tool | `example/tools/List Invoices.json` | `pnfqaPMDG9PohkBi` |
| Get Invoice Totals | Tool | `example/tools/Get Invoice Totals.json` | [Check file] |
| Get Totals by Company | Tool | `example/tools/Get Totals by Company.json` | [Check file] |
| Get Totals by Vendor | Tool | `example/tools/Get Totals by Vendor.json` | [Check file] |
| Get Totals by Company by Product | Tool | `example/tools/Get Totals by Company by Product.json` | [Check file] |

### Step 2.2: Decide Dev/Prod Strategy

**Option A: Current workflows become DEV**
- Rename current workflows to DEV-BillingBot-*
- Reserve new slots for PROD copies

**Option B: Current workflows become PROD**
- Current workflows are already production
- Create new DEV slots for development

**Recommended:** Option A - treat current as DEV, create PROD slots

### Step 2.3: Reserve PROD Slots

Since we need PROD versions of each workflow:

```
User: "Reserve workflows for Billing Bot"

I need PROD slots for:
1. Invoice Agent
2. Billing Bot MVP
3. List Invoices
4. Get Invoice Totals
5. Get Totals by Company
6. Get Totals by Vendor
7. Get Totals by Company by Product

Total: 7 PROD slots needed
```

**Action:** Go to n8n, create 7 empty workflows in the Billing Bot folder

### Step 2.4: Claim the Slots

After creating empty workflows:

```
User: "I've created 7 empty workflows, claim them for PROD"
```

The AI will pull the new workflows and help you assign them.

### Step 2.5: Update id-mappings.json

After registration, your mappings should look like:

```json
{
  "workflows": {
    "InvoiceAgent": {
      "type": "agent",
      "dev": { "id": "YbM4pqxRD0AnOVhb", "status": "active" },
      "prod": { "id": "[new-prod-id]", "status": "reserved" }
    },
    "BillingBotMVP": {
      "type": "agent",
      "dev": { "id": "[existing-id]", "status": "active" },
      "prod": { "id": "[new-prod-id]", "status": "reserved" }
    },
    "ListInvoices": {
      "type": "tool",
      "dev": { "id": "pnfqaPMDG9PohkBi", "status": "active" },
      "prod": { "id": "[new-prod-id]", "status": "reserved" }
    }
    // ... etc
  }
}
```

---

## Phase 3: Rename Existing Workflows

Rename existing workflows to follow the naming convention.

### Step 3.1: Update DEV Workflows in n8n

For each existing workflow, rename to:
- `Invoice Agent` → `DEV-BillingBot-InvoiceAgent`
- `Billing Bot MVP` → `DEV-BillingBot-MVP`
- `List Invoices` → `DEV-BillingBot-ListInvoices`
- etc.

This can be done via MCP or manually in n8n UI.

### Step 3.2: Update PROD Slot Names

Rename the empty PROD slots:
- → `PROD-BillingBot-InvoiceAgent`
- → `PROD-BillingBot-MVP`
- → `PROD-BillingBot-ListInvoices`
- etc.

---

## Phase 4: Test Pull and Push

### Step 4.1: Pull a DEV Workflow

```
User: "Pull DEV Invoice Agent"
```

**Expected:** Workflow saved to `agents/DEV-BillingBot-InvoiceAgent.json`

### Step 4.2: Make a Small Change

Edit the local file - add a comment or note to a sticky note.

### Step 4.3: Push Back to DEV

```
User: "Push DEV Invoice Agent"
```

**Expected:** Changes applied to DEV workflow in n8n

### Step 4.4: Verify in n8n

Open the workflow in n8n and verify the change is visible.

---

## Phase 5: Test Promotion

### Step 5.1: Start with a Simple Tool

Choose `List Invoices` as it has no dependencies on other tools.

```
User: "Promote List Invoices to prod"
```

### Step 5.2: Review Transformation Report

The AI should show:
- Name transformation: DEV → PROD
- ID transformation: dev ID → prod ID
- No tool references (simple workflow)

### Step 5.3: Confirm and Execute

Type "confirm" to execute the promotion.

### Step 5.4: Verify in n8n

1. Open `PROD-BillingBot-ListInvoices` in n8n
2. Verify content matches DEV version
3. Verify workflow name is correct

---

## Phase 6: Test Complex Promotion

### Step 6.1: Promote Invoice Agent

The Invoice Agent references multiple tool workflows. This tests ID transformation.

```
User: "Promote Invoice Agent to prod"
```

### Step 6.2: Review Transformation Report

Should show:
- Name transformation
- Multiple tool reference transformations (List Invoices, Get Totals, etc.)
- Credential transformations (if any)

### Step 6.3: Verify All References Transformed

After promotion, open `PROD-BillingBot-InvoiceAgent` in n8n:
1. Check each tool node
2. Verify workflowId points to PROD versions
3. Test the workflow to ensure tools are called correctly

---

## Pilot Success Criteria

### Must Have
- [ ] Project initialized with config files
- [ ] All workflows registered in id-mappings.json
- [ ] Can pull DEV workflow to local
- [ ] Can push local changes to DEV
- [ ] Can promote simple workflow (no refs) to PROD
- [ ] Can promote complex workflow (with refs) to PROD
- [ ] All IDs transformed correctly during promotion

### Should Have
- [ ] Backup created before PROD updates
- [ ] Audit trail updated in id-mappings.json
- [ ] Validation catches missing PROD mappings

### Nice to Have
- [ ] Tags updated during promotion
- [ ] Credentials transformed (if mapped)

---

## Troubleshooting

### Problem: Workflow ID not found
**Solution:** Check if workflow is registered in id-mappings.json. Run reserve-workflows if needed.

### Problem: Missing PROD mapping during promote
**Solution:** Reserve PROD slot for the referenced workflow first, then retry promotion.

### Problem: Promotion succeeded but workflow doesn't work
**Solution:** Check that all tool references point to PROD IDs. Verify credentials are correct for PROD.

---

## After Pilot Completion

1. Document any issues encountered
2. Update skills if behavior differs from expected
3. Adjust MCP-Test-Plan.md with findings
4. Consider improvements for v1.1
