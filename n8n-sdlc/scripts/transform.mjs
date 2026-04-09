#!/usr/bin/env node
/**
 * Deterministic workflow transformation engine for n8n-sdlc.
 *
 * Handles both promote (DEV -> PROD) and seed (PROD -> DEV) directions.
 * Outputs structured JSON to stdout. Exit code 0 on success, 1 on errors.
 *
 * Usage:
 *   node transform.mjs \
 *     --direction promote \
 *     --workflow "Support Agent" \
 *     --source ./agents/DEV-Support\ Agent.json \
 *     --mappings n8n-sdlc/config/id-mappings.json \
 *     --config n8n-sdlc/config/project.json
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { REF_NODE_TYPES } from './lib/constants.mjs';
import {
  loadJson,
  findMappingByDevId,
  findMappingByProdId,
  isExternalDependency,
  getDevPrefix,
  getCredentialMappings,
  parseArgs,
} from './lib/mappings.mjs';

/**
 * Transform a workflow between environments.
 *
 * @param {object} sourceWorkflow - The source workflow JSON.
 * @param {'promote'|'seed'} direction - Transformation direction.
 * @param {string} logicalName - Workflow logical name (PROD name, id-mappings key).
 * @param {object} idMappings - Parsed id-mappings.json.
 * @param {object} projectConfig - Parsed project.json.
 * @returns {{success: boolean, workflow?: object, report?: object, errors?: object[]}}
 */
export function transformWorkflow(
  sourceWorkflow,
  direction,
  logicalName,
  idMappings,
  projectConfig,
) {
  const result = structuredClone(sourceWorkflow);
  const prefix = getDevPrefix(projectConfig);
  const entry = idMappings.workflows[logicalName];
  const report = { name: {}, id: {}, references: [], credentials: [], stripped: [] };
  const errors = [];

  if (!entry) {
    return {
      success: false,
      errors: [{ type: 'missing-mapping', workflow: logicalName }],
    };
  }

  // 1. Transform workflow name
  if (direction === 'promote') {
    result.name = result.name.startsWith(prefix)
      ? result.name.slice(prefix.length)
      : result.name;
  } else {
    result.name = result.name.startsWith(prefix)
      ? result.name
      : prefix + result.name;
  }
  report.name = { from: sourceWorkflow.name, to: result.name };

  // 2. Transform workflow ID
  const targetId =
    direction === 'promote' ? entry.prod?.id : entry.dev?.id;
  if (!targetId) {
    return {
      success: false,
      errors: [
        {
          type: `missing-${direction === 'promote' ? 'prod' : 'dev'}-id`,
          workflow: logicalName,
        },
      ],
    };
  }
  report.id = { from: result.id, to: targetId };
  result.id = targetId;

  // 3. Strip pinData (promote only)
  if (direction === 'promote' && result.pinData) {
    result.pinData = {};
    report.stripped.push('pinData');
  }

  // 4. Transform workflowId references
  const sourceField = direction === 'promote' ? 'dev' : 'prod';
  const targetField = direction === 'promote' ? 'prod' : 'dev';

  for (const node of result.nodes || []) {
    if (!REF_NODE_TYPES.includes(node.type)) continue;
    const wfIdObj = node.parameters?.workflowId;
    if (!wfIdObj?.value) continue;

    const refId = wfIdObj.value;

    // External dependency — leave unchanged
    if (isExternalDependency(idMappings, refId)) {
      report.references.push({
        node: node.name,
        id: refId,
        type: 'external',
        action: 'unchanged',
      });
      continue;
    }

    // Find mapping by source env ID
    const findFn =
      direction === 'promote' ? findMappingByDevId : findMappingByProdId;
    const match = findFn(idMappings, refId);

    if (!match) {
      errors.push({
        type: 'unmapped-reference',
        nodeId: node.id,
        nodeName: node.name,
        workflowId: refId,
      });
      continue;
    }

    const [matchName, matchMapping] = match;
    const newId = matchMapping[targetField]?.id;

    if (!newId) {
      errors.push({
        type: `missing-${targetField}-id`,
        workflow: matchName,
        [`${sourceField}Id`]: refId,
      });
      continue;
    }

    wfIdObj.value = newId;
    report.references.push({
      node: node.name,
      from: refId,
      to: newId,
      type: 'in-project',
    });

    // Strip cached list-mode metadata
    if (wfIdObj.cachedResultUrl) {
      delete wfIdObj.cachedResultUrl;
      report.stripped.push(`cachedResultUrl (${node.name})`);
    }
    if (wfIdObj.cachedResultName) {
      delete wfIdObj.cachedResultName;
      report.stripped.push(`cachedResultName (${node.name})`);
    }
  }

  // 5. Transform credential IDs
  const credMappings = getCredentialMappings(projectConfig);
  for (const node of result.nodes || []) {
    if (!node.credentials) continue;
    for (const credType of Object.keys(node.credentials)) {
      const credId = node.credentials[credType].id;
      for (const [alias, mapping] of Object.entries(credMappings)) {
        if (mapping[sourceField] === credId && mapping[targetField]) {
          report.credentials.push({
            node: node.name,
            alias,
            from: credId,
            to: mapping[targetField],
          });
          node.credentials[credType].id = mapping[targetField];
          break;
        }
      }
    }
  }

  // 6. Transform tags (if configured)
  const tagConfig = projectConfig.tags;
  if (tagConfig) {
    const sourceTags = direction === 'promote' ? tagConfig.dev : tagConfig.prod;
    const targetTags = direction === 'promote' ? tagConfig.prod : tagConfig.dev;
    if (sourceTags && targetTags && result.tags) {
      const sourceTagNames = new Set(sourceTags);
      result.tags = result.tags.filter((t) => !sourceTagNames.has(t.name));
      for (const tagName of targetTags) {
        if (!result.tags.some((t) => t.name === tagName)) {
          result.tags.push({ name: tagName });
        }
      }
      report.tags = { removed: [...sourceTags], added: [...targetTags] };
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, workflow: result, report };
}

// CLI entry point
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/transform.mjs');

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const required = ['direction', 'workflow', 'source', 'mappings', 'config'];
  const missing = required.filter((k) => !args[k]);

  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(', ')}`);
    console.error(
      'Usage: node transform.mjs --direction promote|seed --workflow NAME --source PATH --mappings PATH --config PATH',
    );
    process.exit(2);
  }

  if (!['promote', 'seed'].includes(args.direction)) {
    console.error(`Invalid direction: ${args.direction}. Must be "promote" or "seed".`);
    process.exit(2);
  }

  const sourceWorkflow = loadJson(args.source);
  const idMappings = loadJson(args.mappings);
  const projectConfig = loadJson(args.config);

  const output = transformWorkflow(
    sourceWorkflow,
    args.direction,
    args.workflow,
    idMappings,
    projectConfig,
  );

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.success ? 0 : 1);
}
