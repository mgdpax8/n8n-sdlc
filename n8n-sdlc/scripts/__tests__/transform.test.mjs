import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWorkflow } from '../transform.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (name) =>
  JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8'));

const mappings = fix('id-mappings.fixture.json');
const config = fix('project.fixture.json');

describe('transformWorkflow — promote (DEV -> PROD)', () => {
  it('strips dev prefix from name', () => {
    const wf = fix('simple-agent.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.equal(out.success, true);
    assert.equal(out.workflow.name, 'Support Agent');
    assert.equal(out.report.name.from, 'DEV-Support Agent');
    assert.equal(out.report.name.to, 'Support Agent');
  });

  it('swaps workflow ID to prod', () => {
    const wf = fix('simple-agent.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.equal(out.workflow.id, 'prod-agent-001');
    assert.equal(out.report.id.from, 'dev-agent-001');
    assert.equal(out.report.id.to, 'prod-agent-001');
  });

  it('clears pinData', () => {
    const wf = fix('simple-agent.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.deepEqual(out.workflow.pinData, {});
    assert.ok(out.report.stripped.includes('pinData'));
  });

  it('transforms in-project workflowId references to prod IDs', () => {
    const wf = fix('simple-agent.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    const listNode = out.workflow.nodes.find((n) => n.name === 'List Invoices');
    const totalsNode = out.workflow.nodes.find((n) => n.name === 'Get Totals');
    assert.equal(listNode.parameters.workflowId.value, 'prod-tool-001');
    assert.equal(totalsNode.parameters.workflowId.value, 'prod-tool-002');
    assert.equal(out.report.references.length, 2);
    assert.equal(out.report.references[0].type, 'in-project');
  });

  it('leaves external dependencies unchanged', () => {
    const wf = fix('agent-with-external.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.equal(out.success, true);
    const extNode = out.workflow.nodes.find((n) => n.name === 'Shared Lookup');
    assert.equal(extNode.parameters.workflowId.value, 'ext-tool-001');
    const extRef = out.report.references.find((r) => r.type === 'external');
    assert.ok(extRef);
    assert.equal(extRef.action, 'unchanged');
  });

  it('strips cachedResultUrl and cachedResultName from in-project refs', () => {
    const wf = fix('list-mode-refs.json');
    const out = transformWorkflow(wf, 'promote', 'Agent With List Mode', mappings, config);
    assert.equal(out.success, true);
    const node = out.workflow.nodes[0];
    assert.equal(node.parameters.workflowId.value, 'prod-tool-001');
    assert.equal(node.parameters.workflowId.cachedResultUrl, undefined);
    assert.equal(node.parameters.workflowId.cachedResultName, undefined);
    assert.ok(out.report.stripped.some((s) => s.includes('cachedResultUrl')));
    assert.ok(out.report.stripped.some((s) => s.includes('cachedResultName')));
  });

  it('preserves cachedResultUrl on external deps', () => {
    const wf = fix('agent-with-external.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    const extNode = out.workflow.nodes.find((n) => n.name === 'Shared Lookup');
    assert.equal(extNode.parameters.workflowId.cachedResultUrl, '/workflow/ext-tool-001');
  });

  it('transforms credential IDs when mapped', () => {
    const wf = fix('workflow-with-creds.json');
    const out = transformWorkflow(wf, 'promote', 'Slack Notifier', mappings, config);
    assert.equal(out.success, true);
    const slackNode = out.workflow.nodes.find((n) => n.name === 'Slack Send');
    assert.equal(slackNode.credentials.slackApi.id, 'cred-slack-prod');
    const aiNode = out.workflow.nodes.find((n) => n.name === 'OpenAI');
    assert.equal(aiNode.credentials.azureOpenAiApi.id, 'cred-openai-prod');
    assert.equal(out.report.credentials.length, 2);
  });

  it('leaves unmapped credentials untouched', () => {
    const wf = fix('workflow-with-creds.json');
    const out = transformWorkflow(wf, 'promote', 'Slack Notifier', mappings, config);
    const unmappedNode = out.workflow.nodes.find((n) => n.name === 'Unmapped Cred');
    assert.equal(unmappedNode.credentials.httpHeaderAuth.id, 'cred-unmapped');
  });

  it('transforms tags (removes dev, adds prod)', () => {
    const wf = fix('simple-agent.json');
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    const tagNames = out.workflow.tags.map((t) => t.name);
    assert.ok(!tagNames.includes('dev'));
    assert.ok(tagNames.includes('production'));
  });

  it('handles workflow with no refs', () => {
    const wf = fix('no-refs.json');
    const out = transformWorkflow(wf, 'promote', 'Simple Utility', mappings, config);
    assert.equal(out.success, true);
    assert.equal(out.workflow.name, 'Simple Utility');
    assert.equal(out.workflow.id, 'prod-util-001');
    assert.equal(out.report.references.length, 0);
  });

  it('does not mutate the source workflow', () => {
    const wf = fix('simple-agent.json');
    const original = JSON.parse(JSON.stringify(wf));
    transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.deepEqual(wf, original);
  });
});

describe('transformWorkflow — seed (PROD -> DEV)', () => {
  it('prepends dev prefix to name', () => {
    const wf = {
      name: 'Support Agent',
      id: 'prod-agent-001',
      nodes: [],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'seed', 'Support Agent', mappings, config);
    assert.equal(out.success, true);
    assert.equal(out.workflow.name, 'DEV-Support Agent');
  });

  it('swaps workflow ID to dev', () => {
    const wf = {
      name: 'Support Agent',
      id: 'prod-agent-001',
      nodes: [],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'seed', 'Support Agent', mappings, config);
    assert.equal(out.workflow.id, 'dev-agent-001');
  });

  it('does not strip pinData during seed', () => {
    const wf = {
      name: 'Support Agent',
      id: 'prod-agent-001',
      nodes: [],
      connections: {},
      settings: {},
      pinData: { someNode: [{ json: { x: 1 } }] },
    };
    const out = transformWorkflow(wf, 'seed', 'Support Agent', mappings, config);
    assert.deepEqual(out.workflow.pinData, { someNode: [{ json: { x: 1 } }] });
  });

  it('reverses workflowId references from prod to dev', () => {
    const wf = {
      name: 'Support Agent',
      id: 'prod-agent-001',
      nodes: [
        {
          id: 'n1',
          name: 'List Invoices',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'prod-tool-001', mode: 'id' },
          },
        },
      ],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'seed', 'Support Agent', mappings, config);
    assert.equal(out.workflow.nodes[0].parameters.workflowId.value, 'dev-tool-001');
  });

  it('reverses credential IDs from prod to dev', () => {
    const wf = {
      name: 'Slack Notifier',
      id: 'prod-slack-001',
      nodes: [
        {
          id: 'n1',
          name: 'Slack Send',
          type: 'n8n-nodes-base.slack',
          parameters: {},
          credentials: { slackApi: { id: 'cred-slack-prod', name: 'Slack' } },
        },
      ],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'seed', 'Slack Notifier', mappings, config);
    assert.equal(out.workflow.nodes[0].credentials.slackApi.id, 'cred-slack-dev');
  });

  it('does not double-prefix a name that already has DEV-', () => {
    const wf = {
      name: 'DEV-Support Agent',
      id: 'prod-agent-001',
      nodes: [],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'seed', 'Support Agent', mappings, config);
    assert.equal(out.workflow.name, 'DEV-Support Agent');
  });
});

describe('transformWorkflow — error cases', () => {
  it('returns error for unmapped workflow reference', () => {
    const wf = {
      name: 'DEV-Support Agent',
      id: 'dev-agent-001',
      nodes: [
        {
          id: 'n1',
          name: 'Unknown Tool',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'unknown-id-999', mode: 'id' },
          },
        },
      ],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.equal(out.success, false);
    assert.equal(out.errors[0].type, 'unmapped-reference');
    assert.equal(out.errors[0].workflowId, 'unknown-id-999');
  });

  it('returns error when prod ID is missing for promote', () => {
    const wf = {
      name: 'DEV-No Prod Yet',
      id: 'dev-noprod-001',
      nodes: [],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'promote', 'No Prod Yet', mappings, config);
    assert.equal(out.success, false);
    assert.equal(out.errors[0].type, 'missing-prod-id');
  });

  it('returns error when logical name not found in mappings', () => {
    const wf = {
      name: 'DEV-Ghost Workflow',
      id: 'dev-ghost-001',
      nodes: [],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'promote', 'Ghost Workflow', mappings, config);
    assert.equal(out.success, false);
    assert.equal(out.errors[0].type, 'missing-mapping');
  });

  it('returns error when ref target env ID is missing', () => {
    const wf = {
      name: 'DEV-Support Agent',
      id: 'dev-agent-001',
      nodes: [
        {
          id: 'n1',
          name: 'No Prod Tool',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'dev-noprod-001', mode: 'id' },
          },
        },
      ],
      connections: {},
      settings: {},
    };
    const out = transformWorkflow(wf, 'promote', 'Support Agent', mappings, config);
    assert.equal(out.success, false);
    assert.equal(out.errors[0].type, 'missing-prod-id');
  });
});
