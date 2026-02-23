# Config Directory

This directory contains the configuration files for the n8n SDLC system.

## Files

### `project.json`
Project-level configuration including:
- Project name (used in workflow naming)
- n8n folder name (must match exactly)
- **n8n Project ID** (`n8nProjectId`): n8n project ID from the workflow URL (`projectId=...`). When set, all MCP listing is filtered to this project and updates/deletes are only allowed for workflows in this project. Required to lock MCP to a single project.
- Naming conventions (dev/prod prefixes)
- Environment-specific credential mappings

**Created by**: `n8n-getting-started` skill or manually from template

### `id-mappings.json`
Maps logical workflow names to their n8n IDs:
- Workflow ID mappings (dev and prod)
- Reserved but unclaimed workflow slots
- Credential ID mappings
- Audit trail (promotion history)

**Updated by**: `reserve-workflows`, `push-workflow`, `promote-workflow` skills

## Templates

The `.template` files show the expected structure with examples:
- `project.json.template` - Copy and modify for manual setup
- `id-mappings.json.template` - Reference for structure

## Usage

1. Run the **Getting Started** skill to create these files automatically
2. Or copy the templates and fill in your values manually

## Important Notes

- `project.json` must be created before any other operations
- `id-mappings.json` is updated automatically by the skills
- Do NOT manually edit `id-mappings.json` unless you know what you're doing
- Fields starting with `$` in templates are comments/examples and should be removed
