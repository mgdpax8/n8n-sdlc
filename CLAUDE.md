# n8n SDLC Framework

This project provides dev/prod workflow separation for n8n, which lacks native SDLC capabilities. The AI agent manages workflow versioning, promotion, and synchronization using n8n MCP, config files, and git.

## IDE Support

This framework works with both **Cursor** and **Claude Code**:

- **Cursor**: Rules auto-load from `.cursor/rules/`. Skills appear as Cursor commands from `.cursor/skills/`.
- **Claude Code**: Rules are in this file. Commands are available via `/n8n-*` slash commands from `.claude/commands/`.

Both IDEs share the same skill logic -- `.cursor/skills/` is the single source of truth. Claude Code commands are thin wrappers that read the same SKILL.md files.

## Core Rules

Read `.cursor/rules/n8n-sdlc.md` for the full rules reference. Key points below.

### MCP Folder Constraint

The n8n MCP server (and REST API) creates workflows in "Personal", not project folders. NEVER use `n8n_create_workflow`. Use the Reserve and Claim pattern:

1. Create empty slots in the project folder (automated via Slot Creator or manual)
2. Claim slots by recording IDs in `n8n-sdlc/config/id-mappings.json`
3. Update workflows via MCP with actual content

### Project Scoping

All MCP operations are locked to the project ID in `n8n-sdlc/config/project.json` (`n8nProjectId`). Always pass `projectId` when listing workflows. Verify `shared[0].projectId` before any update.

### Naming Conventions

- **PROD**: Original name (e.g., `Support Agent`)
- **DEV**: Prefix from config (e.g., `DEV-Support Agent`)
- Dev prefix configured in `project.json` -> `naming.devPrefix` (default: `DEV-`)

### Safety

- NEVER push to PROD without explicit user confirmation
- NEVER promote if any in-project workflowId reference lacks a prod mapping
- External dependency references are left untouched (same ID in DEV and PROD)
- Backup PROD state locally before overwriting
- Complete operations fully or not at all (no partial states)

### Forbidden Actions

1. Push to PROD without explicit "confirm"
2. Create workflows via MCP (`n8n_create_workflow`)
3. Promote with unmapped in-project references
4. Delete or overwrite id-mappings.json without backup
5. Modify workflows outside the locked project

## Available Commands

Each command reads the corresponding SKILL.md before executing. In Claude Code, use the slash command. In Cursor, use the trigger phrases or say the command naturally.

| Command (Claude Code) | Cursor Skill | Triggers |
|-----------------------|-------------|----------|
| `/n8n-get-started` | `n8n-sdlc-getting-started` | "get started", "set up SDLC" |
| `/n8n-import-project` | `n8n-sdlc-import-project` | "import project", "discover workflows" |
| `/n8n-reserve-workflows` | `n8n-sdlc-reserve-workflows` | "reserve workflows", "claim slots" |
| `/n8n-seed-dev` | `n8n-sdlc-seed-dev` | "seed dev", "populate dev from prod" |
| `/n8n-push-workflow` | `n8n-sdlc-push-workflow` | "push workflow", "update in n8n" |
| `/n8n-pull-workflow` | `n8n-sdlc-pull-workflow` | "pull workflow", "download from n8n" |
| `/n8n-promote-workflow` | `n8n-sdlc-promote-workflow` | "promote", "push to prod" |
| `/n8n-validate-workflow` | `n8n-sdlc-validate-workflow` | "validate workflow", "check workflow" |
| `/n8n-project-status` | `n8n-sdlc-project-status` | "project status", "show status" |
| `/n8n-git-sync` | `n8n-sdlc-git-sync` | Called automatically by other commands |
| `/n8n-diff-workflow` | `n8n-sdlc-diff-workflow` | "diff workflow", "compare dev prod" |
| `/n8n-rollback-workflow` | `n8n-sdlc-rollback-workflow` | "rollback", "revert workflow" |

## Key Files

| File | Purpose |
|------|---------|
| `n8n-sdlc/config/project.json` | Project config (IDs, naming, git, slot creator) |
| `n8n-sdlc/config/id-mappings.json` | Workflow ID mappings (dev/prod pairs) |
| `.cursor/rules/n8n-sdlc.md` | Full rules and conventions reference |
| `.cursor/rules/n8n-sdlc-workflow-structure.md` | JSON transformation reference for promote/seed |
| `n8n-sdlc/helpers/slot-creator-workflow.json` | Helper workflow for automated slot creation |

## Typical Workflows

**New project with existing workflows:**
Get Started -> Import Project -> Reserve Workflows -> Seed DEV

**Greenfield project:**
Get Started -> Reserve Workflows -> Build in DEV -> Promote to PROD

**Day-to-day development:**
Pull -> Edit locally -> Push to DEV -> Test -> Promote to PROD
