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

Choose the path that fits your situation:

### Path A: GitHub Template (new project)

Use the SDLC repo as a GitHub Template to create a brand-new repo with everything pre-configured.

1. Go to the SDLC repository on GitHub
2. Click **"Use this template"** > **"Create a new repository"**
3. Name your repo, set visibility, and create
4. Clone your new repo:
   ```bash
   git clone <your-new-repo-url> my-n8n-project
   cd my-n8n-project
   ```

This gives you a clean workspace with all SDLC files already in place.

### Path B: Install Script (overlay onto existing project)

Add the SDLC framework to an existing project without overwriting any of your files.

1. Clone the SDLC repo somewhere accessible:
   ```bash
   git clone <sdlc-repository-url> ~/n8n-sdlc-source
   ```
2. Run the install script targeting your project:
   ```bash
   ~/n8n-sdlc-source/install.sh /path/to/my-project
   ```
3. To update the SDLC framework later (after pulling new changes to the source):
   ```bash
   cd ~/n8n-sdlc-source && git pull
   ~/n8n-sdlc-source/install.sh /path/to/my-project --update
   ```

The install script only copies framework-owned files (skills prefixed with `n8n-sdlc-`, the two SDLC rule files, and the `n8n-sdlc/` folder). It never touches your existing rules, skills, or runtime config files (`project.json`, `id-mappings.json`). Use `--dry-run` to preview changes before applying.

### Path C: Manual Copy

Copy these directories into your project workspace by hand:
- `.cursor/rules/n8n-sdlc.md` and `.cursor/rules/n8n-sdlc-workflow-structure.md`
- `.cursor/skills/n8n-sdlc-*/` (all 12 skill folders)
- `n8n-sdlc/` (config templates, schemas, docs)
- Append the entries from `.gitignore` to your project's `.gitignore`

### Shared team project repo

If multiple people work on the same n8n project, create a dedicated repo for that project (using any of the paths above). **Commit `n8n-sdlc/config/project.json` and `n8n-sdlc/config/id-mappings.json`** to that repo (they are shared state for the team). Adjust `n8n-sdlc/.gitignore` accordingly.

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

Workflow JSON files live in folders specified by `localPath` in `n8n-sdlc/config/id-mappings.json` (per workflow). Two layouts are supported:

**Flat layout** (default):
```
project/
├── .cursor/
│   ├── rules/              # AI behavior rules (always active)
│   └── skills/             # AI automation skills (invoked on demand)
├── n8n-sdlc/
│   ├── config/
│   │   ├── project.json    # Project settings
│   │   └── id-mappings.json # Dev/prod ID registry
│   └── docs/               # Documentation
├── agents/                 # Agent workflow JSON files (orchestrators)
└── tools/                  # Tool workflow JSON files (called by agents)
```

**Optional categorized layout** (when `folderStrategy.mode` is `categorized`):
```
project/
├── .cursor/
├── n8n-sdlc/
│   ├── config/
│   └── docs/
├── agents/
│   └── Support Agent/      # Nested by workflow
│       └── DEV-Support Agent.json
└── tools/
    ├── List Invoices.json
    └── Ticket Lookup.json
```

Each workflow's `localPath` in id-mappings points to its folder (e.g., `agents/`, `tools/`, or a nested path).

## Step 5: Review the Configuration

Check `n8n-sdlc/config/project.json` to understand the project setup:
- **n8nProjectId**: Locks all MCP operations to this n8n project
- **projectName**: Optional display name (dashboards, logs). Not used in workflow names.

Check `n8n-sdlc/config/id-mappings.json` to see which workflows are registered:
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

- **PROD workflows**: Original name only (e.g., "Support Agent", "List Invoices")
- **DEV workflows**: `DEV-` prefix + original name (e.g., "DEV-Support Agent", "DEV-List Invoices")

No project name or PROD prefix is used in workflow names.

### External Dependencies

Workflows may reference other workflows in different n8n projects (cross-project refs). The SDLC system operates within a single project. References to workflows outside the locked project are left as-is during push, pull, and promote. Ensure those external workflows exist and are accessible in each environment.

### Folder Categorization

Workflows are classified as agents (orchestrators) or tools (called by agents). The `folderStrategy` in `project.json` controls how workflow JSON files are organized locally: **flat** (agents/ and tools/ only) or **categorized** (nested hierarchy). Each workflow's `localPath` in id-mappings indicates where its JSON file lives.

### MCP Update Behavior

- **Active workflows**: MCP updates publish immediately (changes go live)
- **Inactive workflows**: MCP updates save only (like autosave, no publish)
- **MCP cannot activate/deactivate**: Manual step in n8n UI required

### Safety Rules

- PROD changes always require explicit "confirm" from the user
- The AI will never create workflows via MCP (wrong folder)
- The AI will never promote if any workflow reference lacks a PROD mapping
- Backups are created before overwriting PROD workflows

### Git Sync (Project Repo)

The SDLC automatically commits and pushes to your **project repo** (not the SDLC framework repo) after every operation. This provides a git-based backup and audit trail alongside n8n's built-in versioning.

**Branch model:**
- `dev` -- day-to-day development (push, pull, seed, reserve)
- `main` -- mirrors production (updated via PR after promotion)

**What happens automatically:**
- After every push/pull/seed/promote/reserve, the changed files are committed and pushed
- Commit messages follow a structured format: `[push] DEV-Support Agent`, `[promote] Support Agent (v3)`, etc.
- After promotion, you're offered a PR from `dev` to `main`

**Setup during get-started wizard:**
- The wizard asks if you have a git repo (Question 4)
- If yes, it configures the branch names and switches to `dev`
- If not yet, it helps you initialize one
- If you skip git, all sync is disabled silently

**Disabling:** Set `git.enabled` to `false` in `n8n-sdlc/config/project.json`.

## Common Commands

| What You Want | What to Say |
|---------------|-------------|
| Check project health | "Show project status" |
| Import existing workflows | "Import my project" |
| Populate DEV from PROD | "Seed dev for Support Agent" |
| Pull latest from n8n | "Pull DEV Support Agent" |
| Push local changes | "Push DEV Support Agent" |
| Deploy to production | "Promote Support Agent to prod" |
| Check for drift | "Diff Support Agent" |
| Undo a bad promotion | "Rollback PROD Support Agent" |
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
- If you need to store actual secrets, use `n8n-sdlc/config/secrets.json` (gitignored)
