# Ideas

<!-- Template for new ideas:
### [Short Title]
- **Problem:** What gap or friction does this address?
- **Idea:** Brief description of the solution or concept
- **Notes:** Any context, links, or open questions
-->

## Active Ideas
Ideas being actively considered or explored.

### Bulk Slot Creator Workflow
- **Problem:** The SDLC reserve step requires empty workflow slots to already exist in n8n. If a project needs 25 DEV slots, the user has to manually create 25 empty workflows by hand before the SDLC can claim them. This is tedious and error-prone at scale.
- **Idea:** Create an n8n workflow (shipped as importable JSON in the repo) that the user can paste into their n8n instance. They provide a count (e.g. 25), and the workflow bulk-creates that many empty workflows via the n8n API, ready for the SDLC to reserve and claim.
- **Notes:** Eliminates the most painful manual step in onboarding large projects. Could also handle naming/tagging conventions to make the slots easier to identify before they're claimed.

### Workflow Connection Diagram on Import
- **Problem:** After importing a project, there's no visual map of how workflows connect to each other. Which workflow calls which as a sub-workflow? Which ones trigger others? Users have to dig through JSON to piece together the picture.
- **Idea:** During the import-project step, auto-generate a Mermaid diagram that maps workflow-to-workflow connections (Execute Workflow nodes, sub-workflow calls, workflow triggers). Output it as a .md file so it renders in GitHub and markdown viewers.
- **Notes:** Mermaid renders in GitHub, VS Code, and Cursor. Scope is strictly workflow-to-workflow relationships — not internal node details or credentials.

## Parked
Ideas worth remembering but not pursuing right now.

## Rejected
Ideas considered and intentionally passed on, with a brief reason why.
