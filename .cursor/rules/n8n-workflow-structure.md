# n8n Workflow JSON Structure

This document describes the structure of n8n workflow JSON files and what needs to be transformed during promotion.

## Top-Level Structure

An n8n workflow JSON file contains:

```json
{
  "name": "Workflow Name",           // TRANSFORM during promotion
  "nodes": [...],                    // Contains workflowId refs to TRANSFORM
  "pinData": {...},                  // Test data, strip for PROD
  "connections": {...},              // Node connections
  "active": true,                    // Whether workflow is active
  "settings": {...},                 // Workflow settings
  "versionId": "uuid",               // Internal version tracking
  "meta": {...},                     // Metadata
  "id": "workflowId",                // n8n's ID for this workflow
  "tags": []                         // Tags (update for environment)
}
```

## Fields That Change During Promotion (DEV -> PROD)

### 1. `name` (Required Transformation)

Strip the DEV prefix to get the PROD name:

```json
// Before (dev)
"name": "DEV-Support Agent"

// After (prod)
"name": "Support Agent"
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
      "value": "pnfqaPMDG9PohkBi",  // TRANSFORM: dev ID -> prod ID (in-project only)
      "mode": "id"                    // or "list" with different structure
    }
  },
  "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
  "name": "List Invoices"
}
```

**Search for**: `"type": "@n8n/n8n-nodes-langchain.toolWorkflow"` and `"type": "n8n-nodes-base.executeWorkflow"`

**External dependency references** (IDs found in `externalDependencies` in id-mappings.json) are left untouched -- the same external workflow serves both DEV and PROD.

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

### 5. `pinData` (Strip for PROD)

Always clear pinData when promoting to prevent test data leaking:

```json
"pinData": {}
```

### 6. `tags` (Optional Update)

Update tags to reflect environment:

```json
// Before
"tags": [{"name": "environment:dev"}]

// After
"tags": [{"name": "environment:prod"}]
```

## Fields That Change During Seed DEV (PROD -> DEV)

The reverse of promotion:

1. **`name`**: Prepend dev prefix (`Support Agent` -> `DEV-Support Agent`)
2. **`id`**: Replace with DEV slot ID
3. **`workflowId` references**: PROD IDs -> DEV IDs (in-project only; external refs untouched)
4. **Credentials**: PROD -> DEV (if mapped)

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
      "value": "pnfqaPMDG9PohkBi",  // TRANSFORM THIS (if in-project)
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
      "value": "pnfqaPMDG9PohkBi",  // TRANSFORM THIS (if in-project)
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
    "cachedResultName": "List Invoices"
  }
}
```

**Note**: The `value` field still contains the ID that needs transformation (if in-project). Strip `cachedResultUrl` and `cachedResultName` during promotion (n8n will re-populate).

## Credential Reference Structure

```json
{
  "credentials": {
    "credentialType": {
      "id": "credentialId",    // TRANSFORM if mapped in project.json
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

4. **For each ID, classify it**:
   - Found as a `dev.id` in id-mappings.json workflows -> **in-project, transform**
   - Found in `externalDependencies` -> **external, leave untouched**
   - Not found anywhere -> **ERROR: unmapped reference, STOP**

5. **If any in-project ID lacks a target mapping, STOP promotion**

## Transformation Algorithm (DEV -> PROD Promotion)

```
1. Load DEV workflow JSON
2. Read id-mappings.json and project.json

3. Transform workflow name:
   - Strip devPrefix ("DEV-Support Agent" -> "Support Agent")

4. Transform workflow ID:
   - Replace with target prod workflow ID from id-mappings

5. Strip pinData:
   - Set pinData = {}

6. For each node in nodes[]:
   - If type is toolWorkflow or executeWorkflow:
     - Get workflowId.value
     - Check if ID is in externalDependencies -> SKIP (leave as-is)
     - Look up in id-mappings.json workflows by dev.id
     - If not found and not external: ERROR - unmapped reference
     - If found: replace value with prod.id
     - Strip cachedResultUrl and cachedResultName

7. For each credential reference:
   - Check if credential alias is in project.json mappings
   - If mapped: replace ID with prod credential ID
   - If not mapped: leave as-is (same in both environments)

8. Update tags (if configured):
   - Replace dev tags with prod tags

9. Return transformed JSON
```

## Reverse Transformation Algorithm (PROD -> DEV Seed)

```
1. Load PROD workflow JSON
2. Read id-mappings.json and project.json

3. Transform workflow name:
   - Prepend devPrefix ("Support Agent" -> "DEV-Support Agent")

4. Transform workflow ID:
   - Replace with target dev workflow ID from id-mappings

5. For each node in nodes[]:
   - If type is toolWorkflow or executeWorkflow:
     - Get workflowId.value
     - Check if ID is in externalDependencies -> SKIP (leave as-is)
     - Look up in id-mappings.json workflows by prod.id
     - If found: replace value with dev.id
     - If not found and not external: WARN (reference may be unmanaged)

6. For each credential reference:
   - If mapped in project.json: replace prod ID with dev ID
   - If not mapped: leave as-is

7. Update tags (if configured)

8. Return transformed JSON
```

## Example: Complete Promotion Transformation

### Before (Dev)

```json
{
  "name": "DEV-Support Agent",
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
    },
    {
      "type": "n8n-nodes-base.executeWorkflow",
      "name": "Shared Lookup",
      "parameters": {
        "workflowId": {
          "value": "extWorkflowId123"
        }
      }
    }
  ]
}
```

### After (Prod)

```json
{
  "name": "Support Agent",
  "id": "XyZ789ProdId",
  "pinData": {},
  "nodes": [
    {
      "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
      "name": "List Invoices",
      "parameters": {
        "workflowId": {
          "value": "AbC456ProdToolId"
        }
      },
      "credentials": {
        "mongoDb": {
          "id": "Ggo0MKdauxTlpDyQ",
          "name": "aitobillbot-mongodb"
        }
      }
    },
    {
      "type": "n8n-nodes-base.executeWorkflow",
      "name": "Shared Lookup",
      "parameters": {
        "workflowId": {
          "value": "extWorkflowId123"
        }
      }
    }
  ]
}
```

Note: `List Invoices` workflowId was transformed (in-project). `Shared Lookup` workflowId was left untouched (external dependency).

## Validation Checklist

Before promoting, verify:

- [ ] All in-project `workflowId` values have entries in id-mappings.json
- [ ] All in-project entries have non-null `prod.id` values
- [ ] External dependency references are recorded in `externalDependencies`
- [ ] Credential mappings exist for any environment-specific credentials
- [ ] pinData will be stripped
