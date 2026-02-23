# Skill: n8n Getting Started

Initialize a new n8n project with configuration and folder structure.

**For most users, "import my project" (import-project skill) is the faster path.** It creates config files automatically and discovers your workflows. Use this skill only if you want to set up config manually before importing, or for a pure greenfield project.

## When to Use

- Starting a new n8n project from scratch (greenfield)
- User says "set up n8n project", "initialize project", "getting started"
- No `config/project.json` exists in the workspace

## Prerequisites

- User should know their n8n project ID (from the workflow URL: `projectId=...`)

## Steps

### Step 1: Gather Project Information

Ask the user for:

1. **n8n Project ID** (required): The n8n project ID from any workflow URL in the project (`projectId=...`). This locks all MCP operations to this project.

2. **Project Name** (optional): A display name for dashboards and logs (e.g., `Billing Bot`, `Support Agent`). Not used in workflow names. Can be added later.

3. **Any credentials that differ between dev and prod?**
   - Common examples: Slack (sandbox vs prod app), external APIs
   - If yes, ask for the credential name and both IDs

### Step 2: Create Project Configuration

Create `config/project.json`:

```json
{
  "n8nProjectId": "{n8n Project ID from workflow URL}",
  "projectName": "{Project Name}",
  "naming": {
    "devPrefix": "DEV-"
  },
  "folderStrategy": {
    "mode": "flat",
    "dedicatedTools": "flat"
  },
  "tags": {
    "dev": ["environment:dev"],
    "prod": ["environment:prod"]
  },
  "credentials": {
  },
  "createdAt": "{ISO timestamp}",
  "version": "2.0"
}
```

### Step 3: Create ID Mappings File

Create `config/id-mappings.json` with empty structure:

```json
{
  "workflows": {},
  "externalDependencies": {},
  "reservedSlots": [],
  "credentials": {},
  "metadata": {
    "projectName": "{Project Name}",
    "createdAt": "{ISO timestamp}",
    "lastModified": "{ISO timestamp}"
  }
}
```

### Step 4: Create Folder Structure

Ensure the following folders exist:
- `agents/` - For agent workflow JSON files
- `tools/` - For tool workflow JSON files  
- `docs/` - For documentation
- `config/` - Already created with config files

### Step 5: Verify Rules Exist

Check that the following rules exist in `.cursor/rules/`:
- `n8n-sdlc.md`
- `n8n-workflow-structure.md`

If they don't exist, warn the user that the rules need to be created.

### Step 6: Provide Next Steps

```
Project initialized!

**Two paths from here:**

(a) **Existing workflows in n8n** (most common):
   Run "import my project" to discover and register all your workflows.

(b) **New (greenfield) project**:
   1. Create empty workflows in n8n in your project folder
   2. Run "reserve workflows" to claim the empty slots
   3. Build in DEV slots, then promote to prod

**Files Created:**
- config/project.json
- config/id-mappings.json
```

## Validation Checks

Before creating any files, verify:

1. **No existing project.json**: If `config/project.json` exists, ask user if they want to overwrite
2. **n8n Project ID provided**: Cannot be empty (from workflow URL: projectId=...)

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json already exists | Ask user to confirm overwrite |
| Missing n8n Project ID | Explain: get from workflow URL (projectId=...), required to lock MCP to this project |

## Related Skills

- `import-project.md` - Primary entry point for most users; creates config if needed and discovers workflows
- `reserve-workflows.md` - For greenfield projects to claim workflow slots
- `validate-workflow.md` - Validates project configuration
