#!/usr/bin/env node
/**
 * Configuration and reference validator for n8n-sdlc.
 *
 * Runs validation checks at 4 levels matching the validate-workflow SKILL.md:
 *   config-only  — Checks 1.1–1.7 (file existence, schema, cross-file consistency)
 *   naming       — + Checks 2.1–2.2 (naming conventions)
 *   mapping      — + Checks 3.1–3.4 (id-mapping integrity)
 *   full         — + Checks 4.1–4.2 (reference validation for promote)
 *
 * Usage:
 *   node validate-config.mjs \
 *     --config n8n-sdlc/config/project.json \
 *     --mappings n8n-sdlc/config/id-mappings.json \
 *     --level full \
 *     [--workflow ./agents/DEV-Support\ Agent.json] \
 *     [--direction promote]
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { existsSync, readFileSync } from 'node:fs';
import { REF_NODE_TYPES } from './lib/constants.mjs';
import {
  findMappingByDevId,
  findMappingByProdId,
  isExternalDependency,
  parseArgs,
} from './lib/mappings.mjs';

const LEVELS = ['config-only', 'naming', 'mapping', 'full', 'references'];
const VALID_STATUSES = ['active', 'reserved', 'needs-slot', 'not-started'];
const VALID_TYPES = ['agent', 'tool'];

/**
 * Run validation checks.
 *
 * @param {object} opts
 * @param {string} opts.configPath - Path to project.json.
 * @param {string} opts.mappingsPath - Path to id-mappings.json.
 * @param {string} opts.level - Validation level.
 * @param {string} [opts.workflowPath] - Path to workflow JSON (for Levels 2–4).
 * @param {string} [opts.direction] - 'promote' or 'seed' (for Level 4).
 * @returns {{valid: boolean, checks: object[], summary: {pass: number, warn: number, fail: number}}}
 */
export function validateConfig(opts) {
  const { configPath, mappingsPath, level } = opts;
  const checks = [];
  let config = null;
  let mappings = null;

  const push = (id, name, status, message) => {
    const entry = { id, name, status };
    if (message) entry.message = message;
    checks.push(entry);
  };

  // --- Level 1: Configuration Validation ---

  // 1.1 project.json exists
  if (!existsSync(configPath)) {
    push('1.1', 'project.json exists', 'fail', `${configPath} not found`);
    return buildResult(checks);
  }
  push('1.1', 'project.json exists', 'pass');

  // 1.2 project.json is valid JSON with required fields
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    push('1.2', 'project.json valid JSON', 'fail', `Parse error: ${e.message}`);
    return buildResult(checks);
  }

  if (!config.n8nProjectId || typeof config.n8nProjectId !== 'string') {
    push('1.2', 'project.json required fields', 'fail', 'Missing or empty n8nProjectId');
  } else if (!config.naming?.devPrefix || typeof config.naming.devPrefix !== 'string') {
    push('1.2', 'project.json required fields', 'fail', 'Missing naming.devPrefix');
  } else {
    push('1.2', 'project.json required fields', 'pass');
  }

  // 1.3 id-mappings.json exists
  if (!existsSync(mappingsPath)) {
    push('1.3', 'id-mappings.json exists', 'fail', `${mappingsPath} not found`);
    return buildResult(checks);
  }
  push('1.3', 'id-mappings.json exists', 'pass');

  // Parse mappings
  try {
    mappings = JSON.parse(readFileSync(mappingsPath, 'utf-8'));
  } catch (e) {
    push('1.4', 'id-mappings.json valid JSON', 'fail', `Parse error: ${e.message}`);
    return buildResult(checks);
  }

  // 1.5 project.json structural validation
  const configErrors = validateConfigStructure(config);
  if (configErrors.length > 0) {
    push('1.5', 'project.json structure', 'fail', configErrors.join('; '));
  } else {
    push('1.5', 'project.json structure', 'pass');
  }

  // 1.6 id-mappings.json structural validation
  const mappingsErrors = validateMappingsStructure(mappings);
  if (mappingsErrors.length > 0) {
    push('1.6', 'id-mappings.json structure', 'fail', mappingsErrors.join('; '));
  } else {
    push('1.6', 'id-mappings.json structure', 'pass');
  }

  // 1.7 Cross-file consistency
  const crossErrors = validateCrossFile(config, mappings);
  if (crossErrors.length > 0) {
    push('1.7', 'Cross-file consistency', 'fail', crossErrors.join('; '));
  } else {
    push('1.7', 'Cross-file consistency', 'pass');
  }

  if (level === 'config-only') return buildResult(checks);

  // --- Level 2: Naming Convention Validation ---
  if (opts.workflowPath) {
    let workflow;
    try {
      workflow = JSON.parse(readFileSync(opts.workflowPath, 'utf-8'));
    } catch (e) {
      push('2.1', 'Workflow readable', 'fail', `Cannot read workflow: ${e.message}`);
      return buildResult(checks);
    }

    const prefix = config.naming.devPrefix;
    const isDev = workflow.name.startsWith(prefix);
    const logicalName = isDev
      ? workflow.name.slice(prefix.length)
      : workflow.name;

    push('2.1', 'Workflow name follows convention', 'pass',
      `"${workflow.name}" → ${isDev ? 'DEV' : 'PROD'} environment`);
    push('2.2', 'Environment determination', 'pass',
      isDev ? 'Development' : 'Production');

    if (level === 'naming') return buildResult(checks);

    // --- Level 3: ID Mapping Validation ---
    const wfEntry = mappings.workflows?.[logicalName];
    if (!wfEntry) {
      push('3.1', 'Workflow in mappings', 'fail',
        `"${logicalName}" not found in id-mappings.json`);
    } else {
      push('3.1', 'Workflow in mappings', 'pass');

      // 3.2 localPath
      if (!wfEntry.localPath || typeof wfEntry.localPath !== 'string') {
        push('3.2', 'localPath valid', 'fail',
          `Invalid localPath for "${logicalName}"`);
      } else {
        push('3.2', 'localPath valid', 'pass');
      }

      // 3.3 Target env ID
      const targetEnv = isDev ? 'dev' : 'prod';
      if (!wfEntry[targetEnv]?.id) {
        push('3.3', 'Target environment ID exists', 'fail',
          `No ${targetEnv} ID for "${logicalName}"`);
      } else {
        push('3.3', 'Target environment ID exists', 'pass');
      }
    }

    // 3.4 No duplicate IDs (global check)
    const dupErrors = checkDuplicateIds(mappings);
    if (dupErrors.length > 0) {
      push('3.4', 'No duplicate IDs', 'fail', dupErrors.join('; '));
    } else {
      push('3.4', 'No duplicate IDs', 'pass');
    }

    if (level === 'mapping') return buildResult(checks);

    // --- Level 4: Reference Validation ---
    const direction = opts.direction || 'promote';
    const sourceField = direction === 'promote' ? 'dev' : 'prod';
    const targetField = direction === 'promote' ? 'prod' : 'dev';

    const refErrors = [];
    const refWarnings = [];

    for (const node of workflow.nodes || []) {
      if (!REF_NODE_TYPES.includes(node.type)) continue;
      const refId = node.parameters?.workflowId?.value;
      if (!refId) continue;

      if (isExternalDependency(mappings, refId)) continue;

      const findFn = direction === 'promote' ? findMappingByDevId : findMappingByProdId;
      const match = findFn(mappings, refId);

      if (!match) {
        refErrors.push(`Node "${node.name}": unknown reference ${refId}`);
        continue;
      }

      const [matchName, matchEntry] = match;
      if (!matchEntry[targetField]?.id) {
        refErrors.push(
          `Node "${node.name}": "${matchName}" has no ${targetField} ID`,
        );
      }
    }

    if (refErrors.length > 0) {
      push('4.1', 'All references have target mappings', 'fail',
        refErrors.join('; '));
    } else {
      push('4.1', 'All references have target mappings', 'pass');
    }

    // 4.2 Credential mappings
    const credMappings = config.credentials || {};
    const credIssues = [];
    for (const node of workflow.nodes || []) {
      if (!node.credentials) continue;
      for (const credType of Object.keys(node.credentials)) {
        const credId = node.credentials[credType].id;
        for (const [alias, mapping] of Object.entries(credMappings)) {
          if (mapping[sourceField] === credId && !mapping[targetField]) {
            credIssues.push(
              `"${alias}" missing ${targetField} mapping`,
            );
          }
        }
      }
    }

    if (credIssues.length > 0) {
      push('4.2', 'Credential mappings complete', 'warn',
        credIssues.join('; '));
    } else {
      push('4.2', 'Credential mappings complete', 'pass');
    }
  } else if (level !== 'naming' && level !== 'config-only') {
    push('2.0', 'Workflow checks skipped', 'warn',
      'No --workflow provided; Levels 2–4 require a workflow path');
  }

  return buildResult(checks);
}

function validateConfigStructure(config) {
  const errors = [];
  if (typeof config.n8nProjectId !== 'string' || !config.n8nProjectId) {
    errors.push('n8nProjectId must be a non-empty string');
  }
  if (!config.naming || typeof config.naming.devPrefix !== 'string') {
    errors.push('naming.devPrefix must be a string');
  }
  if (config.discoveryMode &&
      !['master', 'full-project'].includes(config.discoveryMode)) {
    errors.push('discoveryMode must be "master" or "full-project"');
  }
  if (config.folderStrategy?.mode &&
      !['flat', 'categorized'].includes(config.folderStrategy.mode)) {
    errors.push('folderStrategy.mode must be "flat" or "categorized"');
  }
  if (config.folderStrategy?.dedicatedTools &&
      !['flat', 'grouped', 'alongside'].includes(config.folderStrategy.dedicatedTools)) {
    errors.push('folderStrategy.dedicatedTools must be "flat", "grouped", or "alongside"');
  }
  return errors;
}

function validateMappingsStructure(mappings) {
  const errors = [];
  if (!mappings.workflows || typeof mappings.workflows !== 'object') {
    errors.push('workflows must be an object');
    return errors;
  }
  if (!mappings.metadata || typeof mappings.metadata !== 'object') {
    errors.push('metadata must be an object');
  } else {
    if (!mappings.metadata.projectName) errors.push('metadata.projectName required');
    if (!mappings.metadata.createdAt) errors.push('metadata.createdAt required');
    if (!mappings.metadata.lastModified) errors.push('metadata.lastModified required');
  }

  for (const [name, wf] of Object.entries(mappings.workflows)) {
    if (!VALID_TYPES.includes(wf.type)) {
      errors.push(`"${name}": type must be "agent" or "tool"`);
    }
    if (typeof wf.localPath !== 'string') {
      errors.push(`"${name}": localPath must be a string`);
    }
    if (wf.dev?.status && !VALID_STATUSES.includes(wf.dev.status)) {
      errors.push(`"${name}": dev.status "${wf.dev.status}" is invalid`);
    }
    if (wf.prod?.status && !VALID_STATUSES.includes(wf.prod.status)) {
      errors.push(`"${name}": prod.status "${wf.prod.status}" is invalid`);
    }
  }

  return errors;
}

function validateCrossFile(config, mappings) {
  const errors = [];

  // Project name consistency
  if (config.projectName && mappings.metadata?.projectName &&
      config.projectName !== mappings.metadata.projectName) {
    errors.push(
      `Project name mismatch: project.json="${config.projectName}" vs id-mappings="${mappings.metadata.projectName}"`,
    );
  }

  // Active workflows must have non-null IDs
  for (const [name, wf] of Object.entries(mappings.workflows)) {
    if (wf.dev?.status === 'active' && !wf.dev.id) {
      errors.push(`"${name}": dev.status is "active" but dev.id is null`);
    }
    if (wf.prod?.status === 'active' && !wf.prod.id) {
      errors.push(`"${name}": prod.status is "active" but prod.id is null`);
    }
  }

  // Duplicate ID checks
  errors.push(...checkDuplicateIds(mappings));

  return errors;
}

function checkDuplicateIds(mappings) {
  const errors = [];
  const devIds = new Map();
  const prodIds = new Map();
  const allIds = new Map();

  for (const [name, wf] of Object.entries(mappings.workflows)) {
    if (wf.dev?.id) {
      if (devIds.has(wf.dev.id)) {
        errors.push(`Duplicate dev ID "${wf.dev.id}": ${devIds.get(wf.dev.id)} and ${name}`);
      }
      devIds.set(wf.dev.id, name);

      if (allIds.has(wf.dev.id)) {
        const prev = allIds.get(wf.dev.id);
        if (prev.name !== name) {
          errors.push(
            `ID "${wf.dev.id}" is dev of "${name}" but ${prev.env} of "${prev.name}"`,
          );
        }
      }
      allIds.set(wf.dev.id, { name, env: 'dev' });
    }

    if (wf.prod?.id) {
      if (prodIds.has(wf.prod.id)) {
        errors.push(`Duplicate prod ID "${wf.prod.id}": ${prodIds.get(wf.prod.id)} and ${name}`);
      }
      prodIds.set(wf.prod.id, name);

      if (allIds.has(wf.prod.id)) {
        const prev = allIds.get(wf.prod.id);
        if (prev.name !== name) {
          errors.push(
            `ID "${wf.prod.id}" is prod of "${name}" but ${prev.env} of "${prev.name}"`,
          );
        }
      }
      allIds.set(wf.prod.id, { name, env: 'prod' });
    }
  }

  return errors;
}

function buildResult(checks) {
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) {
    summary[c.status]++;
  }
  return { valid: summary.fail === 0, checks, summary };
}

// CLI entry point
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/validate-config.mjs');

if (isMain) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.config || !args.mappings) {
    console.error('Missing required arguments: --config and --mappings');
    console.error(
      'Usage: node validate-config.mjs --config PATH --mappings PATH --level LEVEL [--workflow PATH] [--direction promote|seed]',
    );
    process.exit(2);
  }

  const level = args.level || 'full';
  if (!LEVELS.includes(level)) {
    console.error(`Invalid level: ${level}. Must be one of: ${LEVELS.join(', ')}`);
    process.exit(2);
  }

  const output = validateConfig({
    configPath: args.config,
    mappingsPath: args.mappings,
    level: level === 'references' ? 'full' : level,
    workflowPath: args.workflow,
    direction: args.direction,
  });

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.valid ? 0 : 1);
}
