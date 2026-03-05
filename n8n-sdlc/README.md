# n8n SDLC System

A portable, lightweight Software Development Lifecycle (SDLC) framework for managing n8n workflows with dev/prod separation. Pull this into any n8n project workspace to enable version-controlled SDLC.

**Version:** See [VERSION](VERSION) | [Changelog](CHANGELOG.md)

## Overview

This system enables safe development of n8n workflows by providing:

- **Dev/Prod separation** within a single n8n instance
- **Automated ID transformation** during promotion
- **Safety checks** to prevent accidental production changes
- **Drift detection** before pushing changes
- **Rollback** via n8n version history
- **Audit trail** for tracking changes
- **Git sync** -- auto commit/push after every operation, dev/main branch model, PR on promote
- **Portability** -- any team member can use this with any n8n project

## Installation

### Install into an existing project

```bash
git clone <sdlc-repository-url> ~/n8n-sdlc-source
~/n8n-sdlc-source/install.sh /path/to/my-project
```

The script safely merges SDLC files into your project without overwriting your existing rules, skills, or config. Use `--dry-run` to preview, `--update` to refresh an existing installation.

### Start from template

If the repo is configured as a GitHub Template, click **"Use this template"** on GitHub to create a fresh repo with everything pre-configured. (Repo admins: enable this in Settings > General > Template repository.)

See [Team Onboarding](docs/Team-Onboarding.md) for all options including manual setup.

## Quick Start

After installing, open the project in Cursor and:

1. **Run the setup wizard:**

   ```
   Say: "Get started"
   ```

   The wizard walks you through four questions:
   - **How are you starting?** (master workflow, project ID, or greenfield)
   - **Where to store files?** (defaults or custom folder)
   - **How to organize?** (flat or categorized)
   - **Git sync?** (yes, initialize, or skip)

   It creates config and automatically discovers your workflows.

2. **Create DEV slots:**

   ```
   Say: "Reserve workflows"
   ```

3. **Populate DEV from PROD:**

   ```
   Say: "Seed dev"
   ```

4. **Develop in DEV, promote to PROD:**

   ```
   Say: "Promote [workflow name] to prod"
   ```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/n8n-SDLC-PRD.md) | Product Requirements Document |
| [MCP Test Plan](docs/MCP-Test-Plan.md) | MCP behavior tests and results |
| [Pilot Guide](docs/Pilot-Guide-BillingBot.md) | Walkthrough using a sample project |
| [Team Onboarding](docs/Team-Onboarding.md) | Setup guide for new team members |

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `n8n-sdlc-getting-started` | Setup wizard (single entry point) |
| `n8n-sdlc-import-project` | Discover and register existing workflows |
| `n8n-sdlc-reserve-workflows` | Reserve and claim workflow slots |
| `n8n-sdlc-seed-dev` | Populate DEV from PROD with ID transformation |
| `n8n-sdlc-pull-workflow` | Fetch workflow from n8n |
| `n8n-sdlc-push-workflow` | Update workflow in n8n (with drift detection) |
| `n8n-sdlc-promote-workflow` | Promote DEV to PROD with ID transformation |
| `n8n-sdlc-validate-workflow` | Pre-flight validation checks |
| `n8n-sdlc-rollback-workflow` | Rollback using n8n version history |
| `n8n-sdlc-diff-workflow` | Compare local vs remote, detect drift |
| `n8n-sdlc-git-sync` | Auto commit/push to project repo after operations |
| `n8n-sdlc-project-status` | Dashboard of all workflow states |

## Rules Reference

| Rule | Purpose |
|------|---------|
| `n8n-sdlc` | Conventions, safety checks, MCP tool reference, forbidden actions |
| `n8n-sdlc-workflow-structure` | n8n JSON format and transformation logic |

## Directory Structure

**Flat layout** (default):

```
.
├── .cursor/
│   ├── rules/              # SDLC rules and conventions
│   └── skills/             # Automation skills
├── n8n-sdlc/
│   ├── config/             # Project configuration
│   │   ├── project.json    # Project settings
│   │   └── id-mappings.json # Dev/prod ID mappings
│   └── docs/               # Documentation
├── agents/                 # Agent workflow JSON files
└── tools/                  # Tool workflow JSON files
```

**Categorized layout** (optional, set during setup wizard):

```
.
├── .cursor/
├── n8n-sdlc/
│   ├── config/
│   └── docs/
├── agents/                 # Top-level agents (entry points)
│   └── agents/             # Sub-agents (agents called by other agents)
└── tools/                  # Shared tools
    └── {parent}/           # Dedicated tools grouped by parent (optional)
```

## Key Concepts

### Reserve and Claim Pattern

Due to n8n MCP limitations, workflows must be:

1. Created manually in n8n (in the correct folder)
2. Claimed via the SDLC system to get their IDs
3. Updated via MCP (not created)

### Naming Convention

- **PROD** workflows keep their original name (e.g., `Support Agent`, `List Invoices`)
- **DEV** workflows prepend the dev prefix: `DEV-Support Agent`, `DEV-List Invoices`
- No project name in workflow names. No `PROD-` prefix.
- The dev prefix comes from `n8n-sdlc/config/project.json` `naming.devPrefix` (default: `DEV-`)

### External Dependencies

When a workflow references another workflow that belongs to a **different** n8n project:

- The system records it in `id-mappings.json` under `externalDependencies`
- During promotion and seeding, external `workflowId` references are **left untouched** (same ID serves both DEV and PROD)
- External workflows are never pulled, modified, or managed by this SDLC

### Folder Categorization

During import, you can choose how workflows are organized locally:

- **Flat**: All agents in `agents/`, all tools in `tools/`
- **Categorized**: Top-level agents in `agents/`, sub-agents in `agents/agents/`, shared tools in `tools/`, with optional grouping of dedicated tools by parent

### Git Sync

Every SDLC operation that changes local files automatically commits and pushes to the project's git repo:

- Day-to-day work commits to the `dev` branch
- Promoting to PROD offers a PR from `dev` to `main`
- The `main` branch always mirrors what's running in production
- Git sync can be disabled by setting `git.enabled` to `false` in `project.json`

### ID Transformation

When promoting DEV → PROD (or seeding PROD → DEV), the system transforms:

| What | Transformation |
|------|-----------------|
| **Name** | Strip `DEV-` prefix for promotion; prepend it for seeding |
| **Workflow ID** | dev ID ↔ prod ID |
| **Tool references** | In-project only: dev tool IDs ↔ prod tool IDs. External refs left untouched. |
| **Credentials** | If mapped in `project.json`, dev credential IDs ↔ prod credential IDs |

## Safety Features

- **Explicit confirmation** required for PROD changes
- **Pre-flight validation** before every operation
- **Backup** of PROD workflows before overwriting
- **Audit trail** in id-mappings.json

## Getting Help

- Check the skill files in `.cursor/skills/` for detailed instructions
- Review rules in `.cursor/rules/` for conventions
- Examine examples in `example/` for reference

## Status

This project is in active development. The n8n MCP server must be enabled to use the push/pull/promote features.
