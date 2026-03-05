---
name: n8n-sdlc-getting-started
description: Initialize the n8n SDLC system for a new project. Walks through setup questions, creates config files, and routes to workflow discovery. Use when setting up SDLC for the first time, user says "get started", "set up SDLC", "onboard my workflows", or no n8n-sdlc/config/project.json exists.
---

The single entry point for onboarding into the n8n SDLC. Walks the user through setup questions, creates config files, and routes to the correct next skill.

## When to Use

- First time setting up SDLC for any n8n project
- User says "get started", "set up SDLC", "onboard my workflows", "import my project"
- No `n8n-sdlc/config/project.json` exists in the workspace
- User provides a workflow ID or project ID without existing config

## Prerequisites

- n8n MCP server must be available

## Wizard Flow

If `n8n-sdlc/config/project.json` already exists, skip to **Routing** at the end.

### Question 1: How are you starting?

```
Welcome to n8n SDLC setup! How would you like to get started?

1. I have a master workflow
   Give me a workflow name or ID and I'll trace all connected
   workflows automatically. No project ID needed -- I'll find it.

2. I want all workflows in a project
   Give me a project ID and I'll pull every workflow in it.

3. Starting from scratch (greenfield)
   No existing workflows yet. I'll set up config so you can
   build and version-control new workflows.
```

**Option 1 -- Master workflow:**
1. Ask for the master workflow name or ID
2. Fetch it via MCP:
   ```
   MCP Tool: n8n_get_workflow
   Parameters:
     - id: {workflow ID}
     - mode: "full"
   ```
3. Extract `shared[0].projectId` from the response -- this becomes `n8nProjectId`
4. Confirm with the user:
   ```
   Found "{workflow name}" in project {projectId}.
   I'll lock all operations to this project. Continue?
   ```
5. Store the workflow ID as `masterWorkflowId` in config for n8n-sdlc-import-project to use
6. Set `discoveryMode` to `"master"` in config

**Option 2 -- Full project pull:**
1. Ask for the n8n project ID (from any workflow URL: `projectId=...`)
2. Store as `n8nProjectId`
3. Set `discoveryMode` to `"full-project"` in config

**Option 3 -- Greenfield:**
1. Ask for the n8n project ID (from any workflow URL: `projectId=...`)
2. Store as `n8nProjectId`
3. No `discoveryMode` needed

### Question 2: Where to store workflow files?

```
Where should I store workflow JSON files?

1. Use defaults
   Files go in agents/ and tools/ at the workspace root.

2. Choose a folder
   Specify a base directory and I'll create agents/ and tools/ inside it.
```

If the user chooses a custom folder, ask:
```
What folder should I use?
(e.g., "workflows/", "src/n8n/", "my-project/")
```

Store the answer as `workflowsDir` in config (`""` for default).

### Question 3: How to organize files?

```
How should workflow files be organized?

1. Flat (simple)
   All agents in agents/, all tools in tools/.

2. Categorized (mirrors your architecture)
   Sub-agents nested under agents/agents/, shared vs dedicated
   tools separated, hierarchy based on your dependency graph.
```

If the user chooses categorized, ask about dedicated tool placement:
```
For tools used by only one workflow, where should they go?

1. Flat -- all in tools/ (simplest)
2. Grouped by parent -- in tools/{parent-name}/ subfolders
3. Alongside parent -- same folder as the calling workflow
```

Store the answers as `folderStrategy` in config.

### Question 4: Git sync

```
Do you have a git repo set up for this n8n project?

1. Yes -- I'll sync changes to GitHub automatically after every operation
2. Not yet -- I'll help you initialize one
3. No git -- skip git sync for now
```

**Option 1 -- Yes:**
1. Verify the workspace is a git repo with a remote
2. Ask for branch names (offer defaults):
   ```
   What branch names do you use?

   Dev branch (default: dev):
   Main/prod branch (default: main):
   ```
3. If the dev branch doesn't exist, create it:
   ```bash
   git checkout -b {devBranch}
   git push -u origin {devBranch}
   ```
4. Switch to the dev branch
5. Store settings in `project.json` under `git`

**Option 2 -- Not yet:**
1. Initialize if needed: `git init`
2. Ask for the remote URL:
   ```
   What is the GitHub repo URL?
   (e.g., https://github.com/your-org/your-project)
   ```
3. Add remote: `git remote add origin {url}`
4. Create dev branch and push:
   ```bash
   git checkout -b dev
   git push -u origin dev
   ```
5. Store settings in `project.json` under `git`

**Option 3 -- No git:**
1. Set `git.enabled` to `false` in config
2. All git sync steps in other skills will be skipped silently

### Question 5: Slot Creator (Optional)

```
Would you like to set up the Slot Creator for automated workflow creation?

The Slot Creator is a helper workflow that runs in your n8n instance.
It lets the AI agent automatically create empty workflow slots in your
project folder, instead of you creating them manually in the UI.

1. Yes -- I'll walk you through importing and configuring it
2. Skip -- I'll set this up later (or use manual slot creation)
```

**Option 1 -- Yes:**
1. Tell the user to import the helper workflow:
   ```
   To set up the Slot Creator:

   1. In n8n, go to your project folder
   2. Import the file: n8n-sdlc/helpers/slot-creator-workflow.json
   3. Open the imported "SDLC Slot Creator" workflow
   4. Toggle it to Active
   5. Click the Webhook node ("Receive Request")
   6. Copy the Production webhook URL

   Paste the webhook URL here when ready.
   ```
2. Wait for the user to provide the webhook URL
3. Store in config as `slotCreator.webhookUrl`
4. Confirm:
   ```
   Slot Creator configured! The reserve step will use this
   webhook to auto-create workflow slots.

   Note: You'll need an n8n API key when the reserve step runs.
   The API key is asked for at that time and is never stored.
   ```

**Option 2 -- Skip:**
1. Leave `slotCreator.webhookUrl` as `""` in config
2. The reserve skill will fall back to manual slot creation

### Question 6: .gitignore

Check if `.gitignore` exists in the workspace root.

**If `.gitignore` does NOT exist:**
```
Would you like me to create a recommended .gitignore for your n8n project?

It will ignore:
- Workflow backup files (*.backup.*.json)
- OS/editor files (.DS_Store, .vscode/, etc.)
- SDLC version marker (.sdlc-version)
- node_modules/

It will NOT ignore your workflow JSON files -- those should be
tracked in git so you have a full version history.
```

If the user says yes, create `.gitignore` with:
```
# Workflow backups (generated during promotions)
**/*.backup.*.json

# SDLC version marker (written by install.sh)
.sdlc-version

# OS files
Thumbs.db
Desktop.ini
.DS_Store

# Editor / IDE
.vscode/
*.swp
*.swo
*~

# Node (if any tooling is added later)
node_modules/
```

**If `.gitignore` already exists:**
Read its contents and check if recommended entries are present. If any are missing, offer to add them:
```
Your .gitignore exists. I noticed a few recommended entries are missing:
- **/*.backup.*.json (workflow backups)
- .sdlc-version

Want me to append these? (Your existing entries won't be changed.)
```

Only append entries the user approves. Never remove or modify existing entries.

### Question 7 (Optional): Project name and credentials

After the core questions:
1. **Project Name** (optional): A display name for logs (e.g., `Billing Bot`). Can be added later.
2. **Credentials** (optional): Any credentials that differ between dev and prod? If yes, collect the alias and both IDs. Can be added later.

## Create Config Files

### `n8n-sdlc/config/project.json`

```json
{
  "n8nProjectId": "{derived or provided}",
  "projectName": "",
  "workflowsDir": "",
  "discoveryMode": "master",
  "masterWorkflowId": "abc123",
  "naming": { "devPrefix": "DEV-" },
  "folderStrategy": { "mode": "flat", "dedicatedTools": "flat" },
  "git": { "enabled": true, "devBranch": "dev", "mainBranch": "main", "autoPush": true },
  "slotCreator": { "webhookUrl": "" },
  "tags": { "dev": ["environment:dev"], "prod": ["environment:prod"] },
  "credentials": {},
  "createdAt": "{ISO timestamp}",
  "version": "2.0"
}
```

Field notes:
- `discoveryMode`: `"master"` or `"full-project"`. Omit for greenfield.
- `masterWorkflowId`: Only set when `discoveryMode` is `"master"`.
- `workflowsDir`: User's chosen base path, or `""` for workspace root.
- `folderStrategy`: From Question 3 answers.
- `git`: From Question 4 answers. Omit or set `enabled: false` if no git.
- `slotCreator`: From Question 5. Empty string if skipped.

### `n8n-sdlc/config/id-mappings.json`

```json
{
  "workflows": {},
  "externalDependencies": {},
  "reservedSlots": [],
  "metadata": {
    "projectName": "",
    "createdAt": "{ISO timestamp}",
    "lastModified": "{ISO timestamp}"
  }
}
```

### Create Directories

Based on `workflowsDir`:
- If set: create `{workflowsDir}agents/` and `{workflowsDir}tools/`
- If default: create `agents/` and `tools/` at workspace root
- Always ensure `n8n-sdlc/config/` exists

### Verify Rules Exist

Check that `.cursor/rules/` contains:
- `n8n-sdlc.md`
- `n8n-sdlc-workflow-structure.md`

If missing, warn the user.

## Routing

After config is created (or if it already existed), route based on the setup path:

**Option 1 (master workflow) or Option 2 (full project):**
```
Setup complete! Now running workflow discovery...
```
Immediately proceed to the **n8n-sdlc-import-project** skill. It will read `discoveryMode` and `masterWorkflowId` from config -- no additional questions needed.

**Option 3 (greenfield):**
```
Setup complete!

Next steps:
1. Create empty workflows in n8n in your project folder
2. Say "reserve workflows" to claim the empty slots
3. Build in DEV, then promote to PROD when ready
```

## Error Handling

| Error | Resolution |
|-------|------------|
| project.json already exists | Ask user: overwrite or use existing config? |
| MCP not available | Cannot fetch master workflow; ask for project ID instead |
| Master workflow not found | Verify the ID; check MCP connection |
| Master workflow fetch fails to return projectId | Fall back to asking for project ID manually |

## MCP Commands Used

- `n8n_get_workflow` - Fetch master workflow to derive project ID (Option 1 only)

## Related Skills

- **n8n-sdlc-import-project** - Runs automatically after this for Options 1 and 2
- **n8n-sdlc-reserve-workflows** - Next step for greenfield (Option 3) or after import
- **n8n-sdlc-seed-dev** - Populate DEV workflows from PROD after reserving
- **n8n-sdlc-git-sync** - Automatic git commit/push after SDLC operations
- **n8n-sdlc-project-status** - View the state after setup
