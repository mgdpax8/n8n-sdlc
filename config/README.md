# Config Directory

This directory contains the configuration files for the n8n SDLC system.

## Files

### `project.json`
Project-level configuration including:
- Project name (display only, not used in workflow names)
- n8n folder name (must match exactly)
- **n8n Project ID** (`n8nProjectId`): n8n project ID from the workflow URL (`projectId=...`). When set, all MCP listing is filtered to this project and updates/deletes are only allowed for workflows in this project. Required to lock MCP to a single project.
- Naming convention (`naming.devPrefix`, default "DEV-")
- Folder strategy (flat or categorized)
- Environment-specific credential mappings

**Created by**: `n8n-getting-started` skill or manually from template

### `id-mappings.json`
Maps workflow names to their n8n IDs:
- Workflow ID mappings (dev and prod) keyed by PROD name (the real workflow name)
- `localPath` for each workflow (folder where JSON files are stored)
- External dependencies (cross-project workflow references)
- Reserved but unclaimed workflow slots
- Credential ID mappings
- Audit trail (promotion history)

**Updated by**: `import-project`, `reserve-workflows`, `push-workflow`, `promote-workflow`, `seed-dev` skills

## Templates

The `.template` files show the expected structure with examples:
- `project.json.template` - Copy and modify for manual setup
- `id-mappings.json.template` - Reference for structure

## Usage

1. Say **"Import my project, ID is xyz"** -- creates config and discovers workflows in one step
2. Or run the **Getting Started** skill for manual setup
3. Or copy the templates and fill in your values manually

## Version Control Strategy

This repository is the **SDLC framework** -- a portable toolkit that any team member can pull into their own n8n project workspace.

**Committed to git (the framework):**
- Templates (`project.json.template`, `id-mappings.json.template`)
- JSON Schemas (`project.schema.json`, `id-mappings.schema.json`)
- This README

**Gitignored (per-project, instance-specific):**
- `project.json` -- contains n8n project ID and folder name specific to the user's n8n project
- `id-mappings.json` -- contains workflow IDs specific to the user's n8n project

Each team member creates their own `project.json` and `id-mappings.json` by running the **Getting Started** or **Import Project** skill for their specific n8n project.

**If multiple team members collaborate on the SAME n8n project**, they should create a separate git repo for that project and commit `project.json` and `id-mappings.json` there as shared state.

## Important Notes

- `project.json` must be created before any other operations
- `id-mappings.json` is updated automatically by the skills
- Do NOT manually edit `id-mappings.json` unless you know what you're doing
- Fields starting with `$` in templates are comments/examples and should be removed
- JSON Schema files (`project.schema.json`, `id-mappings.schema.json`) provide validation and IDE autocomplete
