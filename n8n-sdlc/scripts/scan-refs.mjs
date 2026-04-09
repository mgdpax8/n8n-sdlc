#!/usr/bin/env node
/**
 * Reference scanner for n8n-sdlc workflows.
 *
 * Extracts and classifies all workflow references in a workflow JSON file.
 * Outputs structured JSON to stdout.
 *
 * Usage:
 *   node scan-refs.mjs \
 *     --workflow ./agents/DEV-Support\ Agent.json \
 *     --mappings n8n-sdlc/config/id-mappings.json
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { REF_NODE_TYPES } from './lib/constants.mjs';
import {
  loadJson,
  findMappingByDevId,
  findMappingByProdId,
  isExternalDependency,
  parseArgs,
} from './lib/mappings.mjs';

/**
 * Scan a workflow for all workflow references and classify them.
 *
 * @param {object} workflow - Parsed workflow JSON.
 * @param {object} idMappings - Parsed id-mappings.json.
 * @returns {{references: object[], summary: {inProject: number, external: number, unmapped: number}}}
 */
export function scanRefs(workflow, idMappings) {
  const references = [];
  const summary = { inProject: 0, external: 0, unmapped: 0 };

  for (const node of workflow.nodes || []) {
    if (!REF_NODE_TYPES.includes(node.type)) continue;
    const wfIdObj = node.parameters?.workflowId;
    if (!wfIdObj?.value) continue;

    const refId = wfIdObj.value;
    const ref = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      workflowId: refId,
    };

    if (isExternalDependency(idMappings, refId)) {
      ref.classification = 'external';
      summary.external++;
    } else {
      // Try both dev and prod lookups
      const devMatch = findMappingByDevId(idMappings, refId);
      const prodMatch = findMappingByProdId(idMappings, refId);
      const match = devMatch || prodMatch;

      if (match) {
        ref.classification = 'in-project';
        ref.mappedName = match[0];
        ref.environment = devMatch ? 'dev' : 'prod';
        summary.inProject++;
      } else {
        ref.classification = 'unmapped';
        summary.unmapped++;
      }
    }

    references.push(ref);
  }

  return { references, summary };
}

// CLI entry point
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/scan-refs.mjs');

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const required = ['workflow', 'mappings'];
  const missing = required.filter((k) => !args[k]);

  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(', ')}`);
    console.error('Usage: node scan-refs.mjs --workflow PATH --mappings PATH');
    process.exit(2);
  }

  const workflow = loadJson(args.workflow);
  const idMappings = loadJson(args.mappings);

  const output = scanRefs(workflow, idMappings);
  console.log(JSON.stringify(output, null, 2));
}
