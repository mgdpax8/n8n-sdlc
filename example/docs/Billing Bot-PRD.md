# Product Requirements Document (PRD)
## Billing Bot — Pax8 Partner Invoice Assistant

---

### Document Info
| Field | Value |
|-------|-------|
| **Product Name** | Billing Bot |
| **Version** | 1.0 (Pilot) |
| **Author** | Matthew Davenport |
| **Last Updated** | January 22, 2026 |
| **Status** | Pilot |

---

## 1. Executive Summary

Billing Bot is a conversational AI assistant deployed via Slack that enables Pax8 internal teams to quickly retrieve and analyze partner invoice information. By providing a natural language interface to billing data, it reduces the time spent searching through systems and enables faster resolution of partner billing inquiries.

---

## 2. Problem Statement

### Current Pain Points
- **Manual data retrieval**: Team members must navigate multiple systems to find partner invoice details
- **Time-consuming analysis**: Comparing invoices across months or identifying vendor-specific spend requires manual effort
- **Knowledge gaps**: Answering common invoicing process questions requires tribal knowledge or documentation lookups
- **Billing run impact visibility**: Surfacing known issues affecting a partner's invoice requires cross-referencing multiple sources

### Opportunity
A conversational interface can dramatically reduce the time required to answer billing questions, improve accuracy, and provide consistent responses to common inquiries.

---

## 3. Goals & Success Metrics

### Primary Goals
1. Reduce average time to retrieve partner invoice information
2. Provide accurate, secure access to partner billing data
3. Surface billing run impacts and known issues proactively
4. Answer common invoicing process questions instantly

### Key Performance Indicators (KPIs)
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Average query response time | < 45 seconds (standard), < 2 min (large partners) | System logs |
| User adoption rate | TBD% of target users | Slack analytics |
| Query accuracy rate | > 95% | User feedback / QA sampling |
| User satisfaction score | > 4.0 / 5.0 | Pilot feedback survey |
| Time saved per inquiry | TBD minutes | Before/after comparison |

---

## 4. Target Users

### Primary Users
- **Pax8 Internal Teams**: Support, Finance, and Partner Success teams who handle billing inquiries

### User Personas
| Persona | Role | Primary Use Case |
|---------|------|------------------|
| Support Agent | Handles partner tickets | Quick invoice lookups during calls/chats |
| Finance Analyst | Processes billing inquiries | Invoice comparison and analysis |
| Partner Success Manager | Manages partner relationships | Proactive billing health checks |

---

## 5. Core Features & Capabilities

### 5.1 Partner Verification (Security)
| Requirement | Description | Priority |
|-------------|-------------|----------|
| Double verification | Confirm partner identity via exact name OR partner ID before providing invoice data | P0 |
| Session isolation | Each chat session is scoped to a single confirmed partner | P0 |
| New chat for new partner | Users must start a new conversation to query a different partner | P0 |

### 5.2 Partner Information Queries
| Capability | Example Questions | Priority |
|------------|-------------------|----------|
| Location lookup | "Where is [Partner] located?" | P1 |
| ID retrieval | "What is [Partner]'s ID?" | P1 |
| Contact info | "What is [Partner]'s website and phone number?" | P1 |

### 5.3 Invoice Analysis (Requires Partner Confirmation)
| Capability | Example Questions | Priority |
|------------|-------------------|----------|
| Invoice history | "How much were their last 6 invoices?" | P0 |
| Vendor-specific spend | "How much was their Microsoft spend in [Month]?" | P0 |
| Vendor breakdown | "What vendors did [Partner] have on the [Month] invoice?" | P0 |
| Month-over-month comparison | "What changed on the invoice from [Month] to [Month]?" | P0 |
| Company count | "How many companies had charges on the last invoice?" | P1 |
| Product details | "What Microsoft products did they have on the last 2 invoices?" | P1 |

### 5.4 Billing Run Impacts (Requires Partner Confirmation)
| Capability | Example Questions | Priority |
|------------|-------------------|----------|
| Known issues lookup | "Do they have any known issues on their invoice?" | P0 |
| Impact assessment | Surface billing run impacts affecting partner | P0 |

### 5.5 General Invoicing Q&A
| Capability | Example Questions | Priority |
|------------|-------------------|----------|
| Invoice delivery | "How do partners receive their invoices?" | P1 |
| Payment methods | "What payment methods can be used?" | P1 |
| Terminology | "What does NCE stand for?" | P2 |

---

## 6. Out of Scope (v1.0)

The following are explicitly **NOT** included in this release:

| Item | Rationale |
|------|-----------|
| Subscription information | Different data domain; future consideration |
| Catalog product questions | Outside billing scope |
| PSA sync troubleshooting and workflows | Complex integration; requires dedicated tooling |
| Automated credits or Finance actions | Write operations require additional security controls |
| ServiceNow KB and Help portal integration | Future integration candidate |
| MOG Cases (grouped ticket management) | Outside billing scope |
| BoB / Customer Invoices | Partner-level only for v1.0 |

---

## 7. User Experience & Interface

### 7.1 Platform
- **Primary Interface**: Slack (direct message with Billing Bot app)

### 7.2 Conversation Flow

#### Partner Confirmation Flow (3 Steps)

| Step | Action | System Behavior |
|------|--------|-----------------|
| **1. Search** | User provides partner name, website, or ID | Partner Agent searches API, returns numbered list with details (Name, Website, SalesRep, Tier, Region, ID). Asks user to select. |
| **2. Identify** | User selects a partner number | Partner Agent retrieves full details, displays Pax8 Marketplace link, stores in MongoDB (unconfirmed). Asks for explicit "Yes". |
| **3. Confirm** | User says "Yes" | Partner Agent marks `partnerConfirmed=true` in MongoDB. Session locked to this partner. Invoice/Impact tools now available. |

**Exception:** If user provides partner ID directly, Step 1 is skipped. If search returns exactly 1 result, auto-proceeds to Step 2.

#### Post-Confirmation Capabilities

| User Intent | Routing | Tools Used |
|-------------|---------|------------|
| Invoice questions | Invoice Agent | List Invoices, Invoice Diff, Get Invoice Totals |
| "What changed?" questions | Invoice Agent | Invoice Diff - Summary or Detailed |
| Invoice calculations/analysis | Invoice Agent | Get Invoice Totals, Get Totals by Company/Vendor/Product, Get Unique Products, Get Invoice Records |
| Billing run impacts | Billing Run Impact List | Excel download + filter |
| General invoicing Q&A | Q&A Agent | Vector Store (RAG) + Calculator |

#### Session Management
- **Session ID** = Slack `thread_ts` (thread timestamp)
- Partner confirmation persists for entire thread
- To query a different partner → Start new Slack thread

### 7.3 Response Times
| Scenario | Expected Response Time |
|----------|----------------------|
| Standard query | ≤ 45 seconds |
| Large partner query | 1-2 minutes |
| Timeout indicator | "Thinking..." message displayed |

### 7.4 Error Handling
| Scenario | Behavior |
|----------|----------|
| Partner not confirmed | Bot prompts user to provide partner name/ID |
| Bot stuck on verification | User advised to start new chat |
| Query timeout | Graceful timeout message |

---

## 8. Technical Architecture

### 8.1 Technology Stack
| Component | Technology |
|-----------|------------|
| Workflow Automation | n8n |
| Chat Interface | Slack API (SlackTrigger + Slack nodes) |
| AI/LLM | Azure OpenAI (GPT-4.1, GPT-4.1-mini, GPT-5 nano) |
| Embeddings | Azure OpenAI (text-embedding-3-small) |
| Database | MongoDB Atlas |
| Data Sources | Pax8 Marketplace API, Microsoft Graph API |

### 8.2 Multi-Agent Architecture

The Billing Bot uses a **hierarchical multi-agent architecture** with specialized agents:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SLACK INTERFACE                             │
│                   (Direct Messages/Threads)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTER AGENT                               │
│                    (GPT-5 nano)                                 │
│          Determines which agent handles the request             │
│          Memory: billingbot_chats (MongoDB)                     │
└─────────────────────────────────────────────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────────────────┐ ┌─────────────┐
│  PARTNER AGENT  │ │       INVOICE AGENT         │ │  Q&A AGENT  │
│   (GPT-4.1)     │ │      (GPT-4.1-mini)         │ │  (GPT-4.1)  │
│                 │ │                             │ │             │
│ Memory:         │ │ Memory:                     │ │ Memory:     │
│ billingbot_     │ │ billingbot_chats_invoice    │ │ billingbot_ │
│ chats_partner   │ │                             │ │ chats       │
└─────────────────┘ └─────────────────────────────┘ └─────────────┘
          │                   │                           │
          ▼                   ▼                           ▼
┌─────────────────┐ ┌─────────────────────────────┐ ┌─────────────┐
│     TOOLS       │ │          TOOLS              │ │    TOOLS    │
│ • Search Partner│ │ • List Invoices             │ │ • Vector    │
│ • Find Specific │ │ • Invoice Diff - Summary    │ │   Store     │
│   Partner       │ │ • Invoice Diff - Detailed   │ │   Search    │
│ • Partner       │ │ • Get Invoice Totals        │ │ • Calculator│
│   Confirmed     │ │ • Get Totals by Company     │ │             │
│                 │ │ • Get Totals by Vendor      │ │             │
│                 │ │ • Get Totals by Company     │ │             │
│                 │ │   by Product                │ │             │
│                 │ │ • Get Unique Products       │ │             │
│                 │ │ • Get Invoice Records       │ │             │
│                 │ │ • Calculator                │ │             │
└─────────────────┘ └─────────────────────────────┘ └─────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ BILLING RUN IMPACT  │
                   │        LIST         │
                   │ (Excel via MS Graph)│
                   └─────────────────────┘
```

### 8.3 Agent Details

| Agent | Model | Purpose | Tools |
|-------|-------|---------|-------|
| **Router Agent** | GPT-5 nano | Orchestrates requests, routes to specialized agents | Partner Agent, Invoice Agent, Q&A Agent, Billing Run Impact List |
| **Partner Agent** | GPT-4.1 | Partner search, verification, confirmation | Search for Partner (API), Find Specific Partner, Partner Confirmed |
| **Invoice Agent** | GPT-4.1-mini | Invoice queries, analysis, comparisons | List Invoices, Invoice Diff (Summary/Detailed), Get Invoice Totals, Get Totals by Company, Get Totals by Vendor, Get Totals by Company by Product, Get Unique Products, Get Invoice Records, Calculator |
| **Q&A Agent** | GPT-4.1 | General billing/invoicing questions | MongoDB Vector Store (RAG), Calculator |

### 8.4 Tool Workflows

| Tool | Type | Description |
|------|------|-------------|
| **Search for Partner** | HTTP Request | Searches Pax8 Marketplace API by name, ID, GUID, website |
| **Find Specific Partner** | Workflow | Retrieves single partner by ID, upserts to MongoDB |
| **Partner Confirmed** | Workflow | Marks partner as confirmed in session state |
| **List Invoices** | Workflow | Fetches invoices by partner ID with pagination |
| **Invoice Diff - Summary** | Workflow | Compares two invoices grouped by company/vendor |
| **Invoice Diff - Detailed** | Workflow | Granular line-item comparison between invoices |
| **Get Invoice Totals** | Workflow | Returns overall sums and counts for filtered invoice rows |
| **Get Totals by Company** | Workflow | Returns totals grouped by company |
| **Get Totals by Vendor** | Workflow | Returns totals grouped by vendor |
| **Get Totals by Company by Product** | Workflow | Returns totals grouped by company and product |
| **Get Unique Products** | Workflow | Returns distinct product names and SKUs |
| **Get Invoice Records** | Workflow | Returns raw filtered invoice line items |
| **Billing Run Impact List** | Workflow | Downloads Excel from SharePoint, filters by partner |
| **User Permission** | Workflow | Validates user access permissions |

### 8.5 Data Storage (MongoDB Atlas)

| Collection | Purpose |
|------------|---------|
| `billingbot_chats` | Router Agent conversation memory |
| `billingbot_chats_partner` | Partner Agent conversation memory |
| `billingbot_chats_invoice` | Invoice Agent conversation memory |
| `billingbot_confirm_partner` | Partner confirmation state per session |
| `billing_bot_knowledge_base` | Vector embeddings for Q&A RAG |

### 8.6 External Integrations

| System | API | Purpose |
|--------|-----|---------|
| **Slack** | Slack API | User interface (DMs, threads) |
| **Pax8 Marketplace** | REST API (OAuth2) | Partner search, invoice data |
| **Microsoft Graph** | REST API (OAuth2) | Billing Run Impact Excel file |
| **Azure OpenAI** | API | LLM inference, embeddings |

### 8.7 Security Requirements
| Requirement | Implementation |
|-------------|----------------|
| Data access | Read-only access to billing data |
| Authentication | Pax8 Slack workspace members only |
| Partner isolation | Session-scoped via `sessionId` (Slack thread_ts) |
| State management | MongoDB stores partner confirmation per session |
| Double verification | 3-step partner confirmation flow in Partner Agent |
| Audit logging | n8n execution logs, MongoDB chat history |

---

## 9. Pilot Program

### 9.1 Pilot Scope
- **Duration**: [TBD]
- **Participants**: Selected internal team members
- **Access Method**: Slack search → "Billing Bot" → App

### 9.2 Pilot Objectives
1. Validate core functionality
2. Gather user feedback
3. Identify edge cases and bugs
4. Measure performance against KPIs
5. Inform GA feature prioritization

### 9.3 Feedback Collection
- In-app feedback mechanism
- Pilot participant survey
- Usage analytics review
- Weekly pilot sync meetings

---

## 10. Future Considerations (Post-Pilot)

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-partner sessions | Query multiple partners without starting new chat | Medium |
| Subscription data | Expand scope to include subscription information | Medium |
| Proactive alerts | Notify users of billing anomalies | Low |
| ServiceNow integration | Pull KB articles and help documentation | Low |
| Write operations | Enable credit requests, adjustments | Low |
| BoB / Customer invoices | Expand to customer-level invoice data | Medium |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incorrect invoice data returned | Medium | High | Double verification; QA sampling; user feedback loop |
| Slow response times for large partners | High | Medium | Set user expectations; optimize queries; consider caching |
| Bot gets "stuck" during verification | Medium | Low | User guidance to start new chat; fix root cause |
| Data security breach | Low | Critical | Session isolation; read-only access; audit logging |
| Low user adoption | Medium | Medium | Training; Slack tips (Star, VIP); champion program |

---

## 12. Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| Slack workspace access | IT/Platform | ✅ Available |
| Partner database API | Data Engineering | [TBD] |
| Invoice system API | Billing Systems | [TBD] |
| n8n infrastructure | Platform/DevOps | [TBD] |
| AI/LLM service | AI Team | [TBD] |

---

## 13. Timeline & Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| PRD Approval | [TBD] | 🟡 In Progress |
| Technical Design Complete | [TBD] | ⚪ Not Started |
| Development Complete | [TBD] | ⚪ Not Started |
| Pilot Launch | [TBD] | ⚪ Not Started |
| Pilot Feedback Review | [TBD] | ⚪ Not Started |
| GA Decision | [TBD] | ⚪ Not Started |

---

## 14. Appendix

### A. Glossary
| Term | Definition |
|------|------------|
| NCE | New Commerce Experience (Microsoft licensing model) |
| BoB | Book of Business |
| MOG | Marketplace Operations Group — handles billing run impacts and grouped ticket cases |
| PSA | Professional Services Automation |
| Billing Run | Periodic process that generates partner invoices |
| Partner | Pax8 customer (MSP/reseller) — not the end customer |
| Company | A partner's customer — appears on partner invoices |
| Session | A Slack thread; identified by `thread_ts` timestamp |
| Router Agent | Main orchestrator that determines which specialized agent handles a request |
| costTotal | Extended cost on invoice line (quantity × cost) |
| Prorate | Partial-month charge due to mid-period subscription changes |

### B. Related Documents
- Billing Bot Pilot Guidance (user-facing)
- [Technical Design Document - TBD]
- [API Documentation - TBD]

---

*This is a living document. Please submit feedback and change requests to the product owner.*

