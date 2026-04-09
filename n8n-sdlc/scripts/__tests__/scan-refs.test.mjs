import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRefs } from '../scan-refs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (name) =>
  JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8'));

const mappings = fix('id-mappings.fixture.json');

describe('scanRefs', () => {
  it('finds in-project references', () => {
    const wf = fix('simple-agent.json');
    const out = scanRefs(wf, mappings);
    assert.equal(out.summary.inProject, 2);
    assert.equal(out.summary.external, 0);
    assert.equal(out.summary.unmapped, 0);
    assert.equal(out.references.length, 2);
    assert.equal(out.references[0].classification, 'in-project');
    assert.equal(out.references[0].mappedName, 'List Invoices');
    assert.equal(out.references[0].environment, 'dev');
  });

  it('finds external dependencies', () => {
    const wf = fix('agent-with-external.json');
    const out = scanRefs(wf, mappings);
    assert.equal(out.summary.inProject, 1);
    assert.equal(out.summary.external, 1);
    const ext = out.references.find((r) => r.classification === 'external');
    assert.equal(ext.workflowId, 'ext-tool-001');
    assert.equal(ext.nodeName, 'Shared Lookup');
  });

  it('flags unmapped references', () => {
    const wf = {
      name: 'Test',
      id: 'test-001',
      nodes: [
        {
          id: 'n1',
          name: 'Unknown Tool',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'unknown-id', mode: 'id' },
          },
        },
      ],
    };
    const out = scanRefs(wf, mappings);
    assert.equal(out.summary.unmapped, 1);
    assert.equal(out.references[0].classification, 'unmapped');
  });

  it('returns empty for workflow with no refs', () => {
    const wf = fix('no-refs.json');
    const out = scanRefs(wf, mappings);
    assert.equal(out.references.length, 0);
    assert.equal(out.summary.inProject, 0);
    assert.equal(out.summary.external, 0);
    assert.equal(out.summary.unmapped, 0);
  });

  it('detects prod-environment references', () => {
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
    };
    const out = scanRefs(wf, mappings);
    assert.equal(out.references[0].classification, 'in-project');
    assert.equal(out.references[0].environment, 'prod');
  });

  it('includes nodeType in output', () => {
    const wf = fix('simple-agent.json');
    const out = scanRefs(wf, mappings);
    assert.equal(
      out.references[0].nodeType,
      '@n8n/n8n-nodes-langchain.toolWorkflow',
    );
    assert.equal(
      out.references[1].nodeType,
      'n8n-nodes-base.executeWorkflow',
    );
  });

  it('handles mixed in-project, external, and unmapped', () => {
    const wf = {
      name: 'DEV-Mixed Agent',
      id: 'dev-agent-001',
      nodes: [
        {
          id: 'n1',
          name: 'In-Project Tool',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'dev-tool-001', mode: 'id' },
          },
        },
        {
          id: 'n2',
          name: 'External Tool',
          type: '@n8n/n8n-nodes-langchain.toolWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'ext-tool-001', mode: 'id' },
          },
        },
        {
          id: 'n3',
          name: 'Mystery Tool',
          type: 'n8n-nodes-base.executeWorkflow',
          parameters: {
            workflowId: { __rl: true, value: 'who-knows', mode: 'id' },
          },
        },
      ],
    };
    const out = scanRefs(wf, mappings);
    assert.equal(out.summary.inProject, 1);
    assert.equal(out.summary.external, 1);
    assert.equal(out.summary.unmapped, 1);
    assert.equal(out.references.length, 3);
  });
});
