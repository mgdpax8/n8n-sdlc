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

1. **Project Name**: A short, PascalCase name for the project (e.g., `BillingBot`, `SupportAgent`)
   - This is used in workflow naming: `DEV-{ProjectName}-{WorkflowName}`
   
2. **n8n Folder Name**: The exact name of the folder in n8n where workflows will live
   - This must match exactly what's shown in n8n UI
   - Example: `AITO - Billing Bot`

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
  "projectName": "{ProjectName}",
  "n8nFolder": "{n8n Folder Name}",
  "n8nProjectId": "{n8n Project ID from workflow URL}",
  "naming": {
    "devPrefix": "DEV-",
    "prodPrefix": "PROD-",
    "separator": "-"
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

### Step 3: Create ID Mappings File

Create `config/id-mappings.json` with empty structure:

```json
{
  "workflows": {},
  "reservedSlots": [],
  "credentials": {},
  "metadata": {
    "projectName": "{ProjectName}",
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
Project "{ProjectName}" has been initialized!

**Next Steps:**

1. **Create empty workflows in n8n**
   - Go to your n8n instance
   - Navigate to the "{n8nFolder}" folder
   - Create empty workflows for each dev AND prod slot you'll need
   - Example: If you need 3 workflows, create 6 empty ones (3 dev + 3 prod)

2. **Run the Reserve Workflows skill**
   - Say "reserve workflows" to claim the empty slots you created
   - This will map n8n workflow IDs to your dev/prod workflow names

3. **Start building!**
   - Build your workflows in the DEV slots
   - When ready, use the Promote skill to push to prod

**Files Created:**
- config/project.json
- config/id-mappings.json
```

## Validation Checks

Before creating any files, verify:

1. **No existing project.json**: If `config/project.json` exists, ask user if they want to overwrite
2. **Valid project name**: Must be PascalCase, no spaces or special characters
3. **n8n folder provided**: Cannot be empty
4. **n8n Project ID provided**: Cannot be empty (from workflow URL: projectId=...)

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json already exists | Ask user to confirm overwrite |
| Invalid project name | Explain PascalCase requirement, ask again |
| Missing n8n folder name | Explain requirement, ask again |
| Missing n8n Project ID | Explain: get from workflow URL (projectId=...), required to lock MCP to this project |

## Example Interaction

**User**: "Set up a new n8n project"

**AI**: 
1. Asks for project name
2. Asks for n8n folder name
3. Asks for n8n Project ID (from workflow URL: projectId=...)
4. Asks about environment-specific credentials
5. Creates config files
6. Verifies folder structure
7. Provides next steps summary

## Related Skills

- `reserve-workflows.md` - Run after getting started to claim workflow slots
- `validate-workflow.md` - Validates project configuration
