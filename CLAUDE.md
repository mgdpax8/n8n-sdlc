# n8n SDLC Framework

This project provides dev/prod workflow separation for n8n, which lacks native SDLC capabilities. The AI agent manages workflow versioning, promotion, and synchronization using n8n MCP, config files, and git.

## How This Works

Cursor users get auto-loaded rules and skills from `.cursor/rules/` and `.cursor/skills/`. Claude Code users (you) get this file as the entry point. **Read the referenced SKILL.md file before executing any skill operation.**

## Core Rules

These rules are always active. Full details in `.cursor/rules/n8n-sdlc.md`.

### MCP Folder Constraint
The n8n MCP server (and REST API) creates workflows in "Personal", not project folders. NEVER use `n8n_create_workflow`. Use the Reserve and Claim pattern instead:
1. Create empty slots in the project folder (automated via Slot Creator or manual)
2. Claim slots by recording IDs in `n8n-sdlc/config/id-mappings.json`
3. Update workflows via MCP with actual content

### Project Scoping
All MCP operations are locked to the project ID in `n8n-sdlc/config/project.json` (`n8nProjectId`). Always pass `projectId` when listing workflows. Verify `shared[0].projectId` before any update.

### Naming Conventions
- **PROD**: Original name (e.g., `Support Agent`)
- **DEV**: Prefix from config (e.g., `DEV-Support Agent`)
- Dev prefix configured in `project.json` → `naming.devPrefix` (default: `DEV-`)

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

## Available Skills

Each skill has a SKILL.md with full step-by-step instructions. **Read the SKILL.md before executing.**

| Skill | File | Triggers |
|-------|------|----------|
| **Get Started** | `.cursor/skills/n8n-sdlc-getting-started/SKILL.md` | "get started", "set up SDLC", "onboard" |
| **Import Project** | `.cursor/skills/n8n-sdlc-import-project/SKILL.md` | "import project", "discover workflows" |
| **Reserve Workflows** | `.cursor/skills/n8n-sdlc-reserve-workflows/SKILL.md` | "reserve workflows", "claim slots" |
| **Seed DEV** | `.cursor/skills/n8n-sdlc-seed-dev/SKILL.md` | "seed dev", "populate dev from prod" |
| **Push Workflow** | `.cursor/skills/n8n-sdlc-push-workflow/SKILL.md` | "push workflow", "update in n8n" |
| **Pull Workflow** | `.cursor/skills/n8n-sdlc-pull-workflow/SKILL.md` | "pull workflow", "download from n8n" |
| **Promote** | `.cursor/skills/n8n-sdlc-promote-workflow/SKILL.md` | "promote", "push to prod" |
| **Validate** | `.cursor/skills/n8n-sdlc-validate-workflow/SKILL.md` | "validate workflow", "check workflow" |
| **Project Status** | `.cursor/skills/n8n-sdlc-project-status/SKILL.md` | "project status", "show status" |
| **Git Sync** | `.cursor/skills/n8n-sdlc-git-sync/SKILL.md` | Called automatically by other skills |
| **Diff Workflows** | `.cursor/skills/n8n-sdlc-diff-workflows/SKILL.md` | "diff workflows", "compare dev prod" |
| **Rollback** | `.cursor/skills/n8n-sdlc-rollback/SKILL.md` | "rollback", "revert workflow" |

## Key Files

| File | Purpose |
|------|---------|
| `n8n-sdlc/config/project.json` | Project config (IDs, naming, git, slot creator) |
| `n8n-sdlc/config/id-mappings.json` | Workflow ID mappings (dev/prod pairs) |
| `.cursor/rules/n8n-sdlc-workflow-structure.md` | JSON transformation reference for promote/seed |
| `n8n-sdlc/helpers/slot-creator-workflow.json` | Helper workflow for automated slot creation |

## Typical Workflows

**New project with existing workflows:**
Get Started → Import Project → Reserve Workflows → Seed DEV

**Greenfield project:**
Get Started → Reserve Workflows → Build in DEV → Promote to PROD

**Day-to-day development:**
Pull → Edit locally → Push to DEV → Test → Promote to PROD
