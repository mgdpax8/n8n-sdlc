/**
 * Shared constants for n8n-sdlc scripts.
 * Zero dependencies — Node.js built-ins only.
 */

/** Node types that reference other workflows via workflowId. */
export const REF_NODE_TYPES = [
  '@n8n/n8n-nodes-langchain.toolWorkflow',
  'n8n-nodes-base.executeWorkflow',
];

/** Pattern matching AI/agent node types (for agent vs tool classification). */
export const AI_NODE_TYPE_PATTERN =
  /^@n8n\/n8n-nodes-langchain\.(agent|chainLlm)/;
