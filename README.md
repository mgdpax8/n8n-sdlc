# n8n SDLC System

A lightweight Software Development Lifecycle (SDLC) system for managing n8n workflows with dev/prod separation.

## Overview

This system enables safe development of n8n workflows by providing:
- **Dev/Prod separation** within a single n8n instance
- **Automated ID transformation** during promotion
- **Safety checks** to prevent accidental production changes
- **Audit trail** for tracking changes

## Quick Start

1. **Initialize a new project:**
   ```
   Say: "Set up n8n project"
   ```

2. **Reserve workflow slots:**
   ```
   Say: "Reserve workflows"
   ```

3. **Develop in DEV, promote to PROD:**
   ```
   Say: "Promote [workflow name] to prod"
   ```

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/n8n-SDLC-PRD.md) | Product Requirements Document |
| [MCP Test Plan](docs/MCP-Test-Plan.md) | Tests to run when MCP is enabled |
| [Pilot Guide](docs/Pilot-Guide-BillingBot.md) | Walkthrough using Billing Bot |

## Skills Reference

| Skill | Purpose |
|-------|---------|
| `n8n-getting-started` | Initialize a new project |
| `reserve-workflows` | Reserve and claim workflow slots |
| `pull-workflow` | Fetch workflow from n8n |
| `push-workflow` | Update workflow in n8n |
| `promote-workflow` | Promote DEV to PROD with ID transformation |
| `validate-workflow` | Pre-flight validation checks |

## Rules Reference

| Rule | Purpose |
|------|---------|
| `n8n-sdlc` | Conventions, safety checks, forbidden actions |
| `n8n-workflow-structure` | n8n JSON format and transformation logic |

## Directory Structure

```
.
├── agents/              # Agent workflow JSON files
├── tools/               # Tool workflow JSON files
├── docs/                # Documentation
├── config/              # Project configuration
│   ├── project.json     # Project settings
│   └── id-mappings.json # Dev/prod ID mappings
├── example/             # Reference examples (Billing Bot)
└── .cursor/
    ├── rules/           # SDLC rules and conventions
    └── skills/          # Automation skills
```

## Key Concepts

### Reserve and Claim Pattern

Due to n8n MCP limitations, workflows must be:
1. Created manually in n8n (in the correct folder)
2. Claimed via the SDLC system to get their IDs
3. Updated via MCP (not created)

### Naming Convention

All workflows follow: `{ENV}-{ProjectName}-{WorkflowName}`

- `DEV-BillingBot-InvoiceAgent`
- `PROD-BillingBot-InvoiceAgent`

### ID Transformation

When promoting, the system transforms:
- Workflow name (DEV → PROD prefix)
- Workflow ID (dev ID → prod ID)
- Tool references (dev tool IDs → prod tool IDs)
- Credentials (if mapped)

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
