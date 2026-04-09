import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../build-graph.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (name) =>
  JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8'));

const mappings = fix('id-mappings.fixture.json');
const config = fix('project.fixture.json');

describe('buildGraph — graph structure', () => {
  it('builds correct graph for agent with two tools', () => {
    const agent = fix('simple-agent.json');
    const tool1 = {
      name: 'DEV-List Invoices',
      id: 'dev-tool-001',
      nodes: [{ id: 'n1', name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: {} }],
      connections: {},
    };
    const tool2 = {
      name: 'DEV-Get Totals',
      id: 'dev-tool-002',
      nodes: [{ id: 'n1', name: 'Code', type: 'n8n-nodes-base.code', parameters: {} }],
      connections: {},
    };

    const out = buildGraph([agent, tool1, tool2], mappings, config);

    assert.equal(out.graph['Support Agent'].type, 'agent');
    assert.ok(out.graph['Support Agent'].calls.includes('List Invoices'));
    assert.ok(out.graph['Support Agent'].calls.includes('Get Totals'));
    assert.equal(out.graph['Support Agent'].isTopLevel, true);

    assert.equal(out.graph['List Invoices'].type, 'tool');
    assert.ok(out.graph['List Invoices'].calledBy.includes('Support Agent'));
    assert.equal(out.graph['List Invoices'].isTopLevel, false);

    assert.equal(out.graph['Get Totals'].type, 'tool');
  });

  it('detects external dependencies', () => {
    const agent = fix('agent-with-external.json');
    const tool = {
      name: 'DEV-List Invoices',
      id: 'dev-tool-001',
      nodes: [],
      connections: {},
    };

    const out = buildGraph([agent, tool], mappings, config);
    assert.equal(out.externalDeps.length, 1);
    assert.equal(out.externalDeps[0].name, 'Shared Lookup Tool');
    assert.ok(out.externalDeps[0].referencedBy.includes('Support Agent'));
  });

  it('classifies sub-agents', () => {
    const parent = {
      name: 'DEV-Support Agent',
      id: 'dev-agent-001',
      nodes: [
        { id: 'n1', name: 'AI', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
        {
          id: 'n2', name: 'Child',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { workflowId: { __rl: true, value: 'dev-tool-001', mode: 'id' } },
        },
      ],
      connections: {},
    };
    const child = {
      name: 'DEV-List Invoices',
      id: 'dev-tool-001',
      nodes: [
        { id: 'n1', name: 'AI', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
      ],
      connections: {},
    };

    // Both have AI nodes, but child is called by parent
    const out = buildGraph([parent, child], mappings, config);
    assert.equal(out.graph['List Invoices'].isSubAgent, true);
    assert.equal(out.graph['Support Agent'].isSubAgent, false);
  });

  it('marks shared tools (called by 2+ workflows)', () => {
    const agent1 = {
      name: 'DEV-Support Agent',
      id: 'dev-agent-001',
      nodes: [
        { id: 'n1', name: 'AI', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
        {
          id: 'n2', name: 'Shared',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { workflowId: { __rl: true, value: 'dev-tool-002', mode: 'id' } },
        },
      ],
      connections: {},
    };
    const agent2 = {
      name: 'DEV-Agent With List Mode',
      id: 'dev-agent-002',
      nodes: [
        { id: 'n1', name: 'AI', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
        {
          id: 'n2', name: 'Also Shared',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { workflowId: { __rl: true, value: 'dev-tool-002', mode: 'id' } },
        },
      ],
      connections: {},
    };
    const sharedTool = {
      name: 'DEV-Get Totals',
      id: 'dev-tool-002',
      nodes: [],
      connections: {},
    };

    const out = buildGraph([agent1, agent2, sharedTool], mappings, config);
    assert.equal(out.graph['Get Totals'].isShared, true);
    assert.equal(out.graph['Get Totals'].calledBy.length, 2);
  });
});

describe('buildGraph — seed order', () => {
  it('returns leaf nodes before parents (tools before agents)', () => {
    const agent = fix('simple-agent.json');
    const tool1 = {
      name: 'DEV-List Invoices', id: 'dev-tool-001',
      nodes: [], connections: {},
    };
    const tool2 = {
      name: 'DEV-Get Totals', id: 'dev-tool-002',
      nodes: [], connections: {},
    };

    const out = buildGraph([agent, tool1, tool2], mappings, config);
    const agentIdx = out.seedOrder.indexOf('Support Agent');
    const tool1Idx = out.seedOrder.indexOf('List Invoices');
    const tool2Idx = out.seedOrder.indexOf('Get Totals');
    assert.ok(tool1Idx < agentIdx, 'List Invoices should come before Support Agent');
    assert.ok(tool2Idx < agentIdx, 'Get Totals should come before Support Agent');
  });

  it('handles single node with no deps', () => {
    const wf = fix('no-refs.json');
    const out = buildGraph([wf], mappings, config);
    assert.equal(out.seedOrder.length, 1);
    assert.equal(out.seedOrder[0], 'Simple Utility');
  });

  it('handles diamond dependency (A->B, A->C, B->D, C->D)', () => {
    const d = { name: 'DEV-List Invoices', id: 'dev-tool-001', nodes: [], connections: {} };
    const b = {
      name: 'DEV-Get Totals', id: 'dev-tool-002',
      nodes: [{
        id: 'n1', name: 'Call D',
        type: 'n8n-nodes-base.executeWorkflow',
        parameters: { workflowId: { __rl: true, value: 'dev-tool-001', mode: 'id' } },
      }],
      connections: {},
    };
    const c = {
      name: 'DEV-Slack Notifier', id: 'dev-slack-001',
      nodes: [{
        id: 'n1', name: 'Call D',
        type: 'n8n-nodes-base.executeWorkflow',
        parameters: { workflowId: { __rl: true, value: 'dev-tool-001', mode: 'id' } },
      }],
      connections: {},
    };
    const a = {
      name: 'DEV-Support Agent', id: 'dev-agent-001',
      nodes: [
        { id: 'n1', name: 'AI', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
        {
          id: 'n2', name: 'Call B',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { workflowId: { __rl: true, value: 'dev-tool-002', mode: 'id' } },
        },
        {
          id: 'n3', name: 'Call C',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: { workflowId: { __rl: true, value: 'dev-slack-001', mode: 'id' } },
        },
      ],
      connections: {},
    };

    const out = buildGraph([a, b, c, d], mappings, config);
    const dIdx = out.seedOrder.indexOf('List Invoices');
    const bIdx = out.seedOrder.indexOf('Get Totals');
    const cIdx = out.seedOrder.indexOf('Slack Notifier');
    const aIdx = out.seedOrder.indexOf('Support Agent');

    assert.ok(dIdx < bIdx, 'D before B');
    assert.ok(dIdx < cIdx, 'D before C');
    assert.ok(bIdx < aIdx, 'B before A');
    assert.ok(cIdx < aIdx, 'C before A');
  });
});

describe('buildGraph — mermaid output', () => {
  it('generates valid mermaid starting with graph TD', () => {
    const wf = fix('simple-agent.json');
    const tool1 = { name: 'DEV-List Invoices', id: 'dev-tool-001', nodes: [], connections: {} };
    const tool2 = { name: 'DEV-Get Totals', id: 'dev-tool-002', nodes: [], connections: {} };

    const out = buildGraph([wf, tool1, tool2], mappings, config);
    assert.ok(out.mermaid.startsWith('graph TD'));
    assert.ok(out.mermaid.includes('-->'), 'Should have solid arrows');
  });

  it('uses dashed arrows for external deps', () => {
    const wf = fix('agent-with-external.json');
    const tool = { name: 'DEV-List Invoices', id: 'dev-tool-001', nodes: [], connections: {} };

    const out = buildGraph([wf, tool], mappings, config);
    assert.ok(out.mermaid.includes('-.->'), 'Should have dashed arrows for external');
    assert.ok(out.mermaid.includes('EXTERNAL'));
  });

  it('uses rectangles for agents and stadiums for tools', () => {
    const agent = fix('simple-agent.json');
    const tool = { name: 'DEV-List Invoices', id: 'dev-tool-001', nodes: [], connections: {} };

    const out = buildGraph([agent, tool], mappings, config);
    // Tools get stadium shape ([
    assert.ok(out.mermaid.includes('([List Invoices])'));
  });
});
