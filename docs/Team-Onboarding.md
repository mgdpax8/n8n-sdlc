# Team Onboarding Guide

How to set up the n8n SDLC system for a new team member.

## How This Works

This repository is the **SDLC framework** -- a portable toolkit of rules, skills, docs, and templates. You pull it into your own n8n project workspace to enable version-controlled SDLC for any n8n project you work on.

## Prerequisites

Before starting, you need:

1. **Cursor IDE** installed
2. **Access to your n8n instance** (e.g., https://n8n.tech.pax8.com)
3. **n8n user account** with access to the project(s) you'll be developing
4. **Git access** to the SDLC repository
5. **n8n API key** for MCP authentication

## Step 1: Set Up Your Project Workspace

### Option A: Start with this repo (simplest for solo work)

```bash
git clone <sdlc-repository-url> my-n8n-project
cd my-n8n-project
```

### Option B: Copy the SDLC files into an existing project repo

Copy these directories into your project workspace:
- `.cursor/rules/` -- AI behavior rules
- `.cursor/skills/` -- AI automation skills
- `config/` -- Templates and schemas (not the .json files, just .template and .schema.json)
- `docs/` -- Reference documentation

### Option C: Shared team project repo

If multiple people work on the same n8n project, create a dedicated repo for that project. Copy in the SDLC files and **commit `config/project.json` and `config/id-mappings.json`** to that repo (they are shared state for the team). Adjust the `.gitignore` in that repo accordingly.

Open the project directory as your Cursor workspace. The `.cursor/rules/` and `.cursor/skills/` directories will be automatically detected.

## Step 2: Install the n8n MCP Server

The n8n MCP server allows Cursor's AI to interact with your n8n instance.

### Option A: Via Cursor MCP Settings

1. Open Cursor Settings
2. Navigate to MCP Servers
3. Add a new MCP server with:
   - **Name**: `n8n-mcp`
   - **Command**: `npx`
   - **Args**: `["-y", "n8n-mcp"]`
   - **Environment Variables**:
     - `N8N_API_URL`: Your n8n instance URL (e.g., `https://n8n.tech.pax8.com`)
     - `N8N_API_KEY`: Your personal n8n API key

### Option B: Via Config File

Add to your Cursor MCP config (typically `~/.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_URL": "https://n8n.tech.pax8.com",
        "N8N_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Getting Your n8n API Key

1. Log in to your n8n instance
2. Go to Settings > API Keys (or your admin may provide one)
3. Create a new API key
4. Copy the key and add it to your MCP configuration

**Never commit your API key to git.** It should only be in your local MCP configuration.

## Step 3: Verify MCP Connection

In Cursor, ask the AI:

```
Run an n8n health check
```

You should see a successful connection to your n8n instance with version info and available tools.

## Step 4: Understand the Project Structure

```
project/
├── agents/              # Agent workflow JSON files (orchestrators)
├── tools/               # Tool workflow JSON files (called by agents)
├── docs/                # Documentation
├── config/
│   ├── project.json     # Project settings (committed to git)
│   ├── id-mappings.json # Dev/prod ID registry (committed to git)
│   ├── project.schema.json       # Schema for validation
│   └── id-mappings.schema.json   # Schema for validation
├── example/             # Reference examples
└── .cursor/
    ├── rules/           # AI behavior rules (always active)
    └── skills/          # AI automation skills (invoked on demand)
```

## Step 5: Review the Configuration

Check `config/project.json` to understand the project setup:
- **projectName**: Used in workflow naming (`DEV-{ProjectName}-{WorkflowName}`)
- **n8nProjectId**: Locks all MCP operations to this n8n project
- **n8nFolder**: The folder in n8n where workflows live (MCP cannot verify this)

Check `config/id-mappings.json` to see which workflows are registered:
- Each workflow has a DEV and PROD slot with n8n IDs
- Status shows whether each slot is active, reserved, or needs a slot

## Step 6: Verify Your Access

Ask the AI:

```
Show project status
```

This will list all workflows and their current state. Verify you can see the workflows in your n8n project.

## Key Concepts to Understand

### Reserve and Claim Pattern

The MCP **cannot** create workflows in the correct n8n folder. All new workflows must be:
1. Created manually by a human in the n8n UI (in the correct project folder)
2. "Claimed" via the SDLC system to register their IDs

### Naming Convention

All workflows follow: `{ENV}-{ProjectName}-{WorkflowName}`
- `DEV-BillingBot-InvoiceAgent` (development)
- `PROD-BillingBot-InvoiceAgent` (production)

### MCP Update Behavior

- **Active workflows**: MCP updates publish immediately (changes go live)
- **Inactive workflows**: MCP updates save only (like autosave, no publish)
- **MCP cannot activate/deactivate**: Manual step in n8n UI required

### Safety Rules

- PROD changes always require explicit "confirm" from the user
- The AI will never create workflows via MCP (wrong folder)
- The AI will never promote if any workflow reference lacks a PROD mapping
- Backups are created before overwriting PROD workflows

## Common Commands

| What You Want | What to Say |
|---------------|-------------|
| Check project health | "Show project status" |
| Pull latest from n8n | "Pull DEV InvoiceAgent" |
| Push local changes | "Push DEV InvoiceAgent" |
| Deploy to production | "Promote InvoiceAgent to prod" |
| Check for drift | "Diff InvoiceAgent" |
| Undo a bad promotion | "Rollback PROD InvoiceAgent" |
| Add new workflows | "Reserve workflows" |
| Validate setup | "Validate project" |

## Troubleshooting

### MCP not connecting

1. Verify your API key is correct: `n8n_health_check` should succeed
2. Check that `N8N_API_URL` points to the correct instance
3. Restart Cursor after changing MCP configuration
4. Verify `npx` can run: `npx -y n8n-mcp --version`

### Can't see workflows

1. Verify `n8nProjectId` in `project.json` matches your n8n project
2. Ensure your n8n account has access to the project
3. Run `n8n_list_workflows` with the projectId to check

### Push/Pull fails

1. Run "validate project" to check configuration
2. Verify the workflow ID exists in `id-mappings.json`
3. Check if the workflow was deleted or moved in n8n

### Drift detected

1. Run "diff {workflow}" to see what changed
2. Pull the latest version to update your local copy
3. Merge your changes if needed, then push

## Security Notes

- **API keys** are personal and should never be shared or committed
- **Credential IDs** in `project.json` and `id-mappings.json` are n8n internal IDs, not secrets
- **Workflow JSON** may contain credential references (IDs only, not actual secrets)
- If you need to store actual secrets, use `config/secrets.json` (gitignored)
