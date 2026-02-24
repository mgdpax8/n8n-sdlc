# Changelog

All notable changes to the n8n SDLC framework are documented here.

## [0.3.0] - Unreleased

### Added
- `install.sh` script for safe installation into existing projects (merge, never overwrite)
- `VERSION` file and `CHANGELOG.md` for release tracking
- `.sdlc-version` marker written to target projects during install

### Changed
- **Breaking**: Encapsulated framework files into `n8n-sdlc/` subfolder (`config/`, `docs/`, `README.md`)
- **Breaking**: Converted all 12 skills to formal Cursor Agent Skills format (`n8n-sdlc-*/SKILL.md` with YAML frontmatter)
- All skill names now prefixed with `n8n-sdlc-` to prevent collisions with user skills
- Updated all inter-skill references, documentation, and config schemas to use new prefixed names
- `.gitignore` split: framework ignores in `n8n-sdlc/.gitignore`, project ignores at root

### Migration notes
- `.cursor/rules/` and `.cursor/skills/` remain at the workspace root (required by Cursor)
- Config paths changed: `config/project.json` is now `n8n-sdlc/config/project.json`
- Skill references changed: e.g. `import-project.md` is now `n8n-sdlc-import-project`

## [0.2.0] - 2026-02-17

### Added
- Import-project skill for automatic workflow discovery and registration
- Seed-dev skill for reverse promotion (PROD to DEV)
- Git-sync skill for automatic commit/push after operations
- Project-status dashboard skill
- Diff-workflow and rollback-workflow skills
- Validate-workflow pre-flight checks
- MCP test plan documentation
- Pilot guide (BillingBot example)

### Changed
- Overhauled naming conventions (DEV- prefix system)
- Getting-started wizard now routes to import-project automatically

## [0.1.0] - 2026-02-05

### Added
- Initial n8n SDLC system
- Core skills: getting-started, reserve-workflows, pull-workflow, push-workflow, promote-workflow
- Cursor rules for SDLC conventions and workflow structure
- Config templates and schemas (project.json, id-mappings.json)
- Team onboarding documentation
- Git push procedure documentation
