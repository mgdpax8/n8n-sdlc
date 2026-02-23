# Skill: n8n Getting Started

Initialize a new n8n project with all required configuration and folder structure.

**Run this skill FIRST when starting a new n8n project.**

## When to Use

- Starting a new n8n project from scratch
- User says "set up n8n project", "initialize project", "getting started"
- No `config/project.json` exists in the workspace

## Prerequisites

- Workspace should be empty or have only example files
- User should know their project name and n8n folder name

## Steps

### Step 1: Gather Project Information

Ask the user for the following information using the AskQuestion tool:

1. **Project Name**: A short, human-readable name for the project (e.g., `My Billing Project`, `Support Agent`)
   - Used for display only (dashboards, logs, docs)—not used in workflow names
   - User can use any format they prefer (spaces, mixed case, etc.)

2. **n8n Folder Name**: The exact name of the folder in n8n where workflows will live
   - This must match exactly what's shown in n8n UI
   - Example: `AITO - Billing`

3. **n8n Project ID**: The n8n project ID so MCP only lists and updates workflows in this project
   - From the workflow URL: the `projectId=...` value (e.g. open any workflow in the project and copy from the URL)
   - Required so MCP is locked to this project only

4. **Any credentials that differ between dev and prod?**
   - Common examples: Slack (sandbox vs prod app), external APIs
   - If yes, ask for the credential name and both IDs

### Step 2: Create Project Configuration

Create `config/project.json` with the gathered information:

```json
{
  "projectName": "{Project Name}",
  "n8nFolder": "{n8n Folder Name}",
  "n8nProjectId": "{n8n Project ID from workflow URL}",
  "naming": {
    "devPrefix": "DEV-"
  },
  "folderStrategy": {
    "mode": "flat",
    "dedicatedTools": "flat"
  },
  "tags": {
    "dev": ["environment:dev", "project:{projectname-lowercase}"],
    "prod": ["environment:prod", "project:{projectname-lowercase}"]
  },
  "credentials": {
    // Only include if user specified different credentials
  },
  "createdAt": "{ISO timestamp}",
  "version": "1.0"
}
```

**Naming convention**: PROD workflows keep their original name. DEV workflows use `{devPrefix}{name}` (e.g., `DEV-Invoice Agent`). The `devPrefix` comes from `naming.devPrefix` in project.json.

**folderStrategy**: Controls how workflow JSON files are organized locally. Default is `flat` (agents/ and tools/ only). The import-project skill can set up folder categorization (e.g., nested hierarchy) if needed.

### Step 3: Create ID Mappings File

Create `config/id-mappings.json` with empty structure:

```json
{
  "workflows": {},
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

Tell the user:

```
Project "{Project Name}" has been initialized!

**Two paths from here:**

(a) **New (greenfield) project** — You'll create workflows from scratch:
   1. Create empty workflows in n8n in the "{n8nFolder}" folder
   2. Run the **Reserve Workflows** skill ("reserve workflows") to claim the empty slots
   3. Build in DEV slots, then use Promote to push to prod

(b) **Existing (brownfield) project** — You already have workflows in n8n:
   1. Run the **Import Project** skill ("import project") to pull existing workflows into this repo
   2. The import-project skill can also set up folder categorization (folderStrategy) if you want nested organization

**Files Created:**
- config/project.json
- config/id-mappings.json
```

## Validation Checks

Before creating any files, verify:

1. **No existing project.json**: If `config/project.json` exists, ask user if they want to overwrite
2. **Project name provided**: Cannot be empty (any format allowed—display only)
3. **n8n folder provided**: Cannot be empty
4. **n8n Project ID provided**: Cannot be empty (from workflow URL: projectId=...)

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json already exists | Ask user to confirm overwrite |
| Missing project name | Explain requirement, ask again |
| Missing n8n folder name | Explain requirement, ask again |
| Missing n8n Project ID | Explain: get from workflow URL (projectId=...), required to lock MCP to this project |

## Example Interaction

**User**: "Set up a new n8n project"

**AI**: 
1. Asks for project name (any format—display only)
2. Asks for n8n folder name
3. Asks for n8n Project ID (from workflow URL: projectId=...)
4. Asks about environment-specific credentials
5. Creates config files
6. Verifies folder structure
7. Provides next steps summary with both greenfield and brownfield paths

## Related Skills

- `reserve-workflows.md` - Run after getting started for new projects to claim workflow slots
- `import-project.md` - Run for existing workflows already in n8n; can set up folder categorization
- `validate-workflow.md` - Validates project configuration
