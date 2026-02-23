# Product Requirements Document (PRD)
## n8n SDLC System — Dev/Prod Workflow Management

---

### Document Info
| Field | Value |
|-------|-------|
| **Product Name** | n8n SDLC System |
| **Version** | 1.0 |
| **Author** | Matthew Davenport |
| **Last Updated** | February 23, 2026 |
| **Status** | In Development |

---

## 1. Executive Summary

The n8n SDLC System is a lightweight development lifecycle management tool for n8n workflows. It enables safe dev/prod separation within a single n8n instance, automates workflow promotion with ID transformation, and provides guardrails to prevent common mistakes. The system is designed to work with Cursor AI agents, allowing developers to build, test, and deploy n8n workflows with confidence.

---

## 2. Problem Statement

### Current Pain Points

- **No native environment separation**: n8n does not provide built-in dev/prod workflow separation within a single instance
- **Risk of production impact**: Developers editing workflows can accidentally break production systems
- **ID coupling**: When workflows reference other workflows (tools calling tools), those references use n8n IDs that differ between dev and prod copies
- **Manual promotion process**: Copying a workflow from dev to prod requires manually updating all internal ID references
- **No audit trail**: No built-in tracking of what was promoted, when, or by whom

### Opportunity

A structured SDLC system can eliminate these pain points by:
- Enforcing naming conventions that clearly distinguish dev from prod
- Automating ID transformation during promotion
- Providing validation checks at every step
- Creating an audit trail for compliance and debugging

---

## 3. Goals & Success Metrics

### Primary Goals

1. Enable safe development without impacting production workflows
2. Automate the promotion process from dev to prod with ID transformation
3. Provide guardrails and checks to prevent common mistakes
4. Create a repeatable process for any n8n project

### Key Performance Indicators (KPIs)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Accidental prod overwrites | 0 | Incident tracking |
| ID transformation accuracy | 100% | Post-promotion verification |
| Promotion time (manual vs automated) | 90% reduction | Time tracking |
| Developer confidence score | > 4.0 / 5.0 | Survey |

---

## 4. Target Users

### Primary Users

- **AI Agents (Cursor)**: Performing n8n development tasks autonomously
- **Developers**: Using Cursor to build and manage n8n workflows
- **Teams**: Managing multiple n8n projects with shared conventions

### User Personas

| Persona | Role | Primary Use Case |
|---------|------|------------------|
| AI Developer Agent | Cursor AI | Build, test, and promote workflows via natural language |
| Human Developer | n8n Builder | Oversee AI work, handle edge cases, approve promotions |
| Team Lead | Project Manager | Review promotion history, ensure compliance |

---

## 5. Core Features & Capabilities

### 5.1 Project Initialization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| Getting Started skill | Initialize new project with all required config files | P0 |
| Project configuration | Store project name, n8n folder, naming conventions | P0 |
| ID mapping file | Track dev/prod workflow ID relationships | P0 |
| Folder structure | Create agents/, tools/, docs/, config/ directories | P1 |
| localPath tracking | Each workflow mapping includes localPath for file storage location | P0 |

### 5.2 Naming Conventions

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PROD workflow names | Use real names as they appear in n8n (e.g., `Invoice Agent`, `List Invoices`). No project name in workflow names, no PROD- prefix | P0 |
| DEV workflow names | Use `DEV-` prefix + real name (e.g., `DEV-Invoice Agent`, `DEV-List Invoices`) | P0 |
| id-mappings keys | Use PROD workflow names as keys (e.g., `"Invoice Agent"` not `"InvoiceAgent"`) | P0 |

### 5.3 Reserve and Claim Pattern

Due to n8n MCP limitations (new workflows go to "Personal" folder), a workaround pattern is required:

| Requirement | Description | Priority |
|-------------|-------------|----------|
| Slot reservation guidance | Tell user how many empty workflows to create in n8n | P0 |
| Slot claiming | Pull new workflows and assign them to dev/prod roles | P0 |
| ID mapping update | Record claimed IDs in id-mappings.json | P0 |
| Workflow renaming | Update workflow names to follow conventions via MCP | P1 |

### 5.4 Import Project (Brownfield Onboarding)

| Requirement | Description | Priority |
|-------------|-------------|----------|
| Discovery Mode A: Master workflow traversal | Start from a master workflow, recursively follow all workflow references to build the complete dependency tree | P0 |
| Discovery Mode B: Full project pull | List all workflows in the project and build the dependency graph from there | P0 |
| External dependency tracking | Detect workflows referenced by in-project workflows but belonging to a different n8n project; record in externalDependencies; never transform during promotion | P0 |
| Folder categorization | Offer categorized folders (agents/, tools/, sub-agents, grouped tools) or flat structure based on workflow type and hierarchy | P1 |
| localPath assignment | Assign localPath for each workflow based on chosen folder strategy | P0 |

### 5.5 Seed DEV from PROD

| Requirement | Description | Priority |
|-------------|-------------|----------|
| Seed-dev skill | Transform PROD workflow into DEV-ready copy and push to DEV slot (reverse promotion) | P0 |
| Bottom-up seeding order | Seed leaf tools first, then agents that call them | P0 |
| External reference preservation | Leave external workflowId references unchanged during seed | P0 |

### 5.6 Workflow Synchronization

| Capability | Description | Priority |
|------------|-------------|----------|
| Pull workflow | Fetch workflow from n8n by ID or name, save locally | P0 |
| Push workflow | Update existing workflow in n8n from local file | P0 |
| Environment detection | Auto-detect dev/prod from workflow name prefix (DEV- = dev) | P0 |
| Project validation | Verify workflow belongs to configured project | P1 |

### 5.7 Dev-to-Prod Promotion

| Capability | Description | Priority |
|------------|-------------|----------|
| Name transformation | Strip DEV- prefix to get PROD name (e.g., DEV-Invoice Agent → Invoice Agent) | P0 |
| Workflow ID transformation | Replace dev workflowId references with prod IDs for in-project workflows only | P0 |
| External workflowId preservation | Leave external workflowId references untouched during promotion (same ID in both DEV and PROD) | P0 |
| Credential ID transformation | Replace dev credential IDs with prod IDs (where mapped) | P0 |
| Dependency validation | Verify all in-project referenced workflows have prod slots | P0 |
| Dry-run mode | Preview changes without executing | P1 |
| Audit logging | Record promotion timestamp and details | P1 |

### 5.8 Validation & Safety Checks

| Capability | Description | Priority |
|------------|-------------|----------|
| Pre-flight validation | Check config, naming, mappings before any operation | P0 |
| Prod push confirmation | Require explicit "confirm" for production updates | P0 |
| Duplicate ID detection | Prevent two workflows from claiming same n8n ID | P0 |
| Missing slot detection | Block promotion if prod slot doesn't exist | P0 |
| Orphan detection | Warn about local files without mapping entries | P2 |
| Backup before overwrite | Save current prod state before pushing updates | P1 |

---

## 6. Out of Scope (v1.0)

The following are explicitly **NOT** included in this release:

| Item | Rationale |
|------|-----------|
| Full version control | Git-like branching adds complexity; not needed for v1 |
| Automated rollback | Manual rollback is sufficient initially |
| Multi-instance deployment | Focus on single-instance dev/prod separation |
| Automated workflow testing | Outside SDLC scope; could be future enhancement |
| CI/CD integration | Manual promotion is acceptable for v1 |

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology |
|-----------|------------|
| AI Interface | Cursor IDE with Claude |
| n8n Integration | n8n MCP Server |
| Configuration | JSON files (project.json, id-mappings.json) |
| Guidance | Cursor Rules (.cursor/rules/*.md) |
| Automation | Cursor Skills (.cursor/skills/*.md) |

### 7.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CURSOR IDE                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Rules     │  │    Skills    │  │    Config    │          │
│  │  (Guidelines)│  │  (Actions)   │  │   (State)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                │                  │                   │
│         └────────────────┼──────────────────┘                   │
│                          │                                      │
│                          ▼                                      │
│                   ┌──────────────┐                              │
│                   │   AI Agent   │                              │
│                   └──────────────┘                              │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           │ MCP (Update Only)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      n8n INSTANCE                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Project Folder                         │   │
│  │  ┌───────────────┐          ┌───────────────┐          │   │
│  │  │ DEV- Workflows │          │ PROD Workflows │         │   │
│  │  └───────────────┘          └───────────────┘          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 File Structure

```
project-workspace/
├── agents/                    # Agent workflow JSON files
│   └── DEV-Invoice Agent.json
├── tools/                     # Tool workflow JSON files
│   └── DEV-List Invoices.json
├── docs/
│   └── n8n-SDLC-PRD.md       # This document
├── config/
│   ├── project.json          # Project configuration
│   └── id-mappings.json      # Dev/prod ID mappings
├── example/                   # Reference examples
│   └── ...
└── .cursor/
    ├── rules/
    │   ├── n8n-sdlc.md       # SDLC conventions
    │   └── n8n-workflow-structure.md
    └── skills/
        ├── n8n-getting-started.md
        ├── import-project.md
        ├── reserve-workflows.md
        ├── seed-dev.md
        ├── pull-workflow.md
        ├── push-workflow.md
        ├── promote-workflow.md
        └── validate-workflow.md
```

### 7.4 Critical Constraint: MCP Folder Behavior

**The n8n MCP server creates new workflows in the "Personal" folder, not in project folders.**

This constraint requires the "Reserve and Claim" pattern:
1. User manually creates empty workflows in the correct n8n project folder
2. AI pulls these workflows to get their IDs
3. AI "claims" these IDs for specific dev/prod workflow roles
4. AI uses MCP to update (never create) these workflows

---

## 8. Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Prod protection | Explicit confirmation required for any prod changes |
| No direct creation | MCP used only for updates, not creation |
| Audit trail | All promotions logged with timestamps |
| Backup policy | Current prod state saved before overwrite |
| Credential isolation | Environment-specific credentials mapped separately |

---

## 9. Workflow Lifecycle

### 9.1 One-Time Setup (Greenfield)
1. Run "Getting Started" skill
2. User creates empty workflows in n8n project folder
3. Run "Reserve Workflows" skill to claim slots

### 9.2 One-Time Setup (Brownfield)
1. Run "Getting Started" skill
2. Run "Import Project" skill (choose discovery mode: master workflow or full project)
3. Review discovery results and folder categorization
4. User creates empty DEV slots in n8n
5. Run "Reserve Workflows" to claim DEV slots
6. Run "Seed DEV" to populate DEV from PROD (bottom-up order)

### 9.3 Development Cycle
1. Build workflow in n8n (dev slot)
2. Test in n8n
3. Pull to local for review
4. Iterate as needed

### 9.4 Promotion
1. Run "Promote" skill
2. Review transformation summary (name: strip DEV-; IDs: dev→prod for in-project refs; external refs unchanged)
3. Confirm promotion
4. Verify in n8n

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP behavior changes | Low | High | Document MCP version; test on upgrades |
| ID mapping corruption | Medium | High | Validate mappings; backup before changes |
| Unmapped workflow reference | Medium | Medium | Pre-flight check blocks promotion |
| User skips confirmation | Low | High | Confirmation is programmatic, not optional |
| n8n folder structure changes | Low | Medium | Project config stores folder name |

---

## 11. Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| n8n MCP Server | n8n / Community | Available (currently disabled) |
| Cursor IDE | Cursor | Available |
| Cursor Rules/Skills | This project | In Development |

---

## 12. Future Considerations (Post-v1)

| Feature | Description | Priority |
|---------|-------------|----------|
| Automated rollback | One-click revert to previous prod state | Medium |
| Git integration | Commit workflow changes to repository | Medium |
| Multi-project support | Manage multiple projects from one workspace | Low |
| Workflow testing | Automated test execution before promotion | Low |
| CI/CD hooks | Trigger promotions from external systems | Low |

---

## 13. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Agent | An n8n workflow that orchestrates other workflows (tools) |
| Tool | An n8n workflow called by an agent to perform a specific task |
| Slot | A reserved workflow ID in n8n, claimed for dev or prod use |
| Promotion | The process of copying a dev workflow to prod with ID transformation (strip DEV- prefix; transform in-project refs; leave external refs unchanged) |
| MCP | Model Context Protocol - interface for AI to interact with n8n |
| External dependency | A workflow referenced by in-project workflows but belonging to a different n8n project; same ID in both DEV and PROD |

### B. Related Documents

- [Pilot Guide](Pilot-Guide-BillingBot.md) - Example project walkthrough
- n8n MCP Server documentation (external)

---

*This is a living document. Please submit feedback and change requests to the project owner.*
