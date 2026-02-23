# n8n Workflow JSON Structure

This document describes the structure of n8n workflow JSON files and what needs to be transformed during promotion.

## Top-Level Structure

An n8n workflow JSON file contains:

```json
{
  "name": "Workflow Name",           // TRANSFORM during promotion
  "nodes": [...],                    // Contains workflowId refs to TRANSFORM
  "pinData": {...},                  // Test data, usually cleared
  "connections": {...},              // Node connections
  "active": true,                    // Whether workflow is active
  "settings": {...},                 // Workflow settings
  "versionId": "uuid",               // Internal version tracking
  "meta": {...},                     // Metadata
  "id": "workflowId",                // n8n's ID for this workflow
  "tags": []                         // Tags (update for environment)
}
```

## Fields That Change During Promotion

### 1. `name` (Required Transformation)

The workflow name must change from DEV to PROD prefix:

```json
// Before (dev)
"name": "DEV-BillingBot-InvoiceAgent"

// After (prod)  
"name": "PROD-BillingBot-InvoiceAgent"
```

### 2. `id` (Replace with Target ID)

The workflow ID must be the TARGET workflow's ID:

```json
// Before (dev workflow being promoted)
"id": "YbM4pqxRD0AnOVhb"  // dev ID

// After (pushed to prod slot)
"id": "XyZ789ProdId"  // prod ID from id-mappings.json
```

### 3. `nodes[].workflowId` (Critical - Tool References)

When a workflow uses tool nodes (`@n8n/n8n-nodes-langchain.toolWorkflow`), they reference other workflows by ID:

```json
{
  "parameters": {
    "workflowId": {
      "__rl": true,
      "value": "pnfqaPMDG9PohkBi",  // TRANSFORM: dev ID → prod ID
      "mode": "id"                    // or "list" with different structure
    }
  },
  "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
  "name": "List Invoices"
}
```

**Search for**: `"type": "@n8n/n8n-nodes-langchain.toolWorkflow"` and `"type": "n8n-nodes-base.executeWorkflow"`

### 4. `nodes[].credentials` (Conditional Transformation)

Only transform if the credential is mapped in `config/project.json`:

```json
{
  "credentials": {
    "oAuth2Api": {
      "id": "UyMc4dkYbAN56KA5",  // TRANSFORM if mapped
      "name": "Slack - Sandbox"
    }
  }
}
```

### 5. `tags` (Optional Update)

Update tags to reflect environment:

```json
// Before
"tags": [{"name": "environment:dev"}, {"name": "project:billingbot"}]

// After  
"tags": [{"name": "environment:prod"}, {"name": "project:billingbot"}]
```

## Fields That Stay the Same

| Field | Reason |
|-------|--------|
| `nodes[].id` | Node IDs are internal to the workflow |
| `nodes[].position` | Canvas positions don't affect function |
| `connections` | These reference node names, not IDs |
| `settings` | Usually the same between environments |
| `versionId` | n8n regenerates this |

## Node Types That Reference Other Workflows

### Tool Workflow Node

Used in AI agent workflows to call tool workflows:

```json
{
  "parameters": {
    "description": "Tool description",
    "workflowId": {
      "__rl": true,
      "value": "pnfqaPMDG9PohkBi",  // ← TRANSFORM THIS
      "mode": "id"
    },
    "workflowInputs": {...}
  },
  "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
  "typeVersion": 2.2,
  "id": "node-internal-id",
  "name": "List Invoices"
}
```

### Execute Workflow Node

Standard node to call sub-workflows:

```json
{
  "parameters": {
    "workflowId": {
      "__rl": true,
      "value": "pnfqaPMDG9PohkBi",  // ← TRANSFORM THIS
      "mode": "id"
    }
  },
  "type": "n8n-nodes-base.executeWorkflow",
  "name": "Execute Sub-workflow"
}
```

### Alternative `workflowId` Format (List Mode)

Sometimes workflows are selected by name in the UI, using "list" mode:

```json
{
  "workflowId": {
    "__rl": true,
    "value": "pnfqaPMDG9PohkBi",       // Still the ID
    "mode": "list",
    "cachedResultUrl": "/workflow/pnfqaPMDG9PohkBi",
    "cachedResultName": "aito-billingbot — List Invoices"
  }
}
```

**Note**: The `value` field still contains the ID that needs transformation.

## Credential Reference Structure

```json
{
  "credentials": {
    "credentialType": {
      "id": "credentialId",    // ← TRANSFORM if mapped
      "name": "Credential Name"
    }
  }
}
```

Common credential types:
- `oAuth2Api` - OAuth2 credentials
- `mongoDb` - MongoDB connection
- `azureOpenAiApi` - Azure OpenAI
- `slackApi` - Slack

## Finding All References to Transform

To find all workflow references that need transformation:

1. **Search for `toolWorkflow` nodes**:
   ```
   "type": "@n8n/n8n-nodes-langchain.toolWorkflow"
   ```

2. **Search for `executeWorkflow` nodes**:
   ```
   "type": "n8n-nodes-base.executeWorkflow"
   ```

3. **Extract all `workflowId.value` fields from these nodes**

4. **Look up each ID in `id-mappings.json`**

5. **If any ID is not mapped, STOP promotion**

## Transformation Algorithm

```
1. Load workflow JSON
2. Read id-mappings.json

3. Transform workflow name:
   - Replace DEV prefix with PROD prefix
   
4. Transform workflow ID:
   - Replace with target prod workflow ID

5. For each node in nodes[]:
   - If type is toolWorkflow or executeWorkflow:
     - Get workflowId.value
     - Look up in id-mappings.json by dev ID
     - If not found: ERROR - unmapped reference
     - Replace value with prod ID
     
6. For each credential reference:
   - Check if credential alias is in project.json mappings
   - If mapped: replace ID with prod credential ID
   - If not mapped: leave as-is (same in both environments)

7. Update tags (if configured):
   - Replace dev tag with prod tag

8. Return transformed JSON
```

## Example: Complete Transformation

### Before (Dev)

```json
{
  "name": "DEV-BillingBot-InvoiceAgent",
  "id": "YbM4pqxRD0AnOVhb",
  "nodes": [
    {
      "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
      "name": "List Invoices",
      "parameters": {
        "workflowId": {
          "value": "pnfqaPMDG9PohkBi"
        }
      },
      "credentials": {
        "mongoDb": {
          "id": "Ggo0MKdauxTlpDyQ",
          "name": "aitobillbot-mongodb"
        }
      }
    }
  ]
}
```

### After (Prod)

```json
{
  "name": "PROD-BillingBot-InvoiceAgent",
  "id": "XyZ789ProdId",
  "nodes": [
    {
      "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
      "name": "List Invoices",
      "parameters": {
        "workflowId": {
          "value": "AbC456ProdToolId"  // Transformed
        }
      },
      "credentials": {
        "mongoDb": {
          "id": "Ggo0MKdauxTlpDyQ",  // Not transformed (same in both envs)
          "name": "aitobillbot-mongodb"
        }
      }
    }
  ]
}
```

## Validation Checklist

Before promoting, verify:

- [ ] All `workflowId` values have entries in id-mappings.json
- [ ] All entries have non-null `prod.id` values
- [ ] Credential mappings exist for any environment-specific credentials
- [ ] Workflow name follows correct pattern for transformation
