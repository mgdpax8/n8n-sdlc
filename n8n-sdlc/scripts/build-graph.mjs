#!/usr/bin/env node
/**
 * Dependency graph builder for n8n-sdlc workflows.
 *
 * Reads workflow JSON files, builds a dependency graph, computes topological
 * seed order, and generates a Mermaid diagram.
 *
 * Usage:
 *   node build-graph.mjs \
 *     --workflows ./agents/*.json ./tools/*.json \
 *     --mappings n8n-sdlc/config/id-mappings.json \
 *     --config n8n-sdlc/config/project.json
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { readFileSync } from 'node:fs';
import { REF_NODE_TYPES, AI_NODE_TYPE_PATTERN } from './lib/constants.mjs';
import {
  loadJson,
  findMappingByDevId,
  findMappingByProdId,
  isExternalDependency,
  getDevPrefix,
  parseArgs,
} from './lib/mappings.mjs';

/**
 * Build a dependency graph from workflow objects.
 *
 * @param {object[]} workflows - Array of parsed workflow JSON objects.
 * @param {object} idMappings - Parsed id-mappings.json.
 * @param {object} projectConfig - Parsed project.json.
 * @returns {{graph: object, seedOrder: string[], mermaid: string, externalDeps: object[]}}
 */
export function buildGraph(workflows, idMappings, projectConfig) {
  const prefix = getDevPrefix(projectConfig);
  const graph = {};
  const externalDeps = [];

  // Index workflows by their known IDs for lookup
  const wfById = new Map();
  for (const wf of workflows) {
    wfById.set(wf.id, wf);
  }

  // Build graph nodes
  for (const wf of workflows) {
    const logicalName = wf.name.startsWith(prefix)
      ? wf.name.slice(prefix.length)
      : wf.name;

    const hasAiNodes = (wf.nodes || []).some((n) =>
      AI_NODE_TYPE_PATTERN.test(n.type),
    );

    graph[logicalName] = {
      calls: [],
      calledBy: [],
      type: hasAiNodes ? 'agent' : 'tool',
      workflowId: wf.id,
    };
  }

  // Build edges
  for (const wf of workflows) {
    const logicalName = wf.name.startsWith(prefix)
      ? wf.name.slice(prefix.length)
      : wf.name;

    for (const node of wf.nodes || []) {
      if (!REF_NODE_TYPES.includes(node.type)) continue;
      const refId = node.parameters?.workflowId?.value;
      if (!refId) continue;

      if (isExternalDependency(idMappings, refId)) {
        const extEntry = Object.entries(idMappings.externalDependencies || {})
          .find(([, dep]) => dep.id === refId);
        if (extEntry) {
          const existing = externalDeps.find((d) => d.id === refId);
          if (!existing) {
            externalDeps.push({
              name: extEntry[0],
              id: refId,
              referencedBy: [logicalName],
            });
          } else if (!existing.referencedBy.includes(logicalName)) {
            existing.referencedBy.push(logicalName);
          }
        }
        continue;
      }

      // Resolve to logical name
      const devMatch = findMappingByDevId(idMappings, refId);
      const prodMatch = findMappingByProdId(idMappings, refId);
      const match = devMatch || prodMatch;

      if (match && graph[match[0]]) {
        const targetName = match[0];
        if (!graph[logicalName].calls.includes(targetName)) {
          graph[logicalName].calls.push(targetName);
        }
        if (!graph[targetName].calledBy.includes(logicalName)) {
          graph[targetName].calledBy.push(logicalName);
        }
      }
    }
  }

  // Classify hierarchy
  for (const [name, entry] of Object.entries(graph)) {
    entry.isTopLevel = entry.calledBy.length === 0;
    entry.isSubAgent = entry.type === 'agent' && entry.calledBy.length > 0;
    entry.isShared = entry.calledBy.length >= 2;
  }

  // Topological sort (leaf-first / reverse topological for seed order)
  const seedOrder = topologicalSort(graph);

  // Generate Mermaid
  const mermaid = generateMermaid(graph, externalDeps);

  return { graph, seedOrder, mermaid, externalDeps };
}

/**
 * Topological sort — leaf nodes first (tools before agents).
 * Uses Kahn's algorithm. Handles cycles by appending remaining nodes.
 */
function topologicalSort(graph) {
  const inDegree = {};
  const adj = {};

  for (const name of Object.keys(graph)) {
    inDegree[name] = 0;
    adj[name] = [];
  }

  for (const [name, entry] of Object.entries(graph)) {
    for (const child of entry.calls) {
      if (adj[child]) {
        adj[child].push(name);
        inDegree[name]++;
      }
    }
  }

  const queue = [];
  for (const name of Object.keys(graph)) {
    if (inDegree[name] === 0) queue.push(name);
  }

  // Sort queue alphabetically for determinism
  queue.sort();

  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const neighbor of (adj[node] || []).sort()) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  // Handle cycles: append any remaining nodes
  for (const name of Object.keys(graph).sort()) {
    if (!result.includes(name)) result.push(name);
  }

  return result;
}

/**
 * Generate a Mermaid diagram string from the graph.
 */
function generateMermaid(graph, externalDeps) {
  const lines = ['graph TD'];
  const entries = Object.entries(graph);

  // Assign IDs (A-Z, then AA, AB, etc.)
  const idMap = new Map();
  let idx = 0;
  for (const [name] of entries) {
    idMap.set(name, idFromIndex(idx++));
  }
  // External deps get IDs too
  const extIdMap = new Map();
  for (const dep of externalDeps) {
    extIdMap.set(dep.name, idFromIndex(idx++));
  }

  // Draw in-project edges (caller -> callee)
  for (const [name, entry] of entries) {
    const fromId = idMap.get(name);
    for (const child of entry.calls) {
      const toId = idMap.get(child);
      if (toId) {
        const toEntry = graph[child];
        const toShape = toEntry.type === 'agent' ? `[${child}]` : `([${child}])`;
        lines.push(`  ${fromId} --> ${toId}${toShape}`);
      }
    }
  }

  // Draw external dep edges (dashed)
  for (const dep of externalDeps) {
    const extId = extIdMap.get(dep.name);
    for (const caller of dep.referencedBy) {
      const fromId = idMap.get(caller);
      if (fromId) {
        lines.push(`  ${fromId} -.-> ${extId}([${dep.name}\\nEXTERNAL])`);
      }
    }
  }

  // Declare standalone nodes (no edges drawn yet)
  for (const [name, entry] of entries) {
    const nodeId = idMap.get(name);
    const hasEdge = lines.some(
      (l) => l.includes(`${nodeId} -->`) || l.includes(`${nodeId} -.->`) ||
             l.includes(`--> ${nodeId}`),
    );
    if (!hasEdge) {
      const shape = entry.type === 'agent' ? `[${name}]` : `([${name}])`;
      lines.push(`  ${nodeId}${shape}`);
    }
  }

  // Declare source nodes with shapes
  for (const [name, entry] of entries) {
    const nodeId = idMap.get(name);
    if (entry.calls.length > 0 || entry.calledBy.length === 0) {
      const shape = entry.type === 'agent' ? `[${name}]` : `([${name}])`;
      // Only add declaration if not already a standalone
      const alreadyDeclared = lines.some(
        (l) => l.trim().startsWith(`${nodeId}[`) || l.trim().startsWith(`${nodeId}(`),
      );
      if (!alreadyDeclared) {
        // Insert after "graph TD"
        lines.splice(1, 0, `  ${nodeId}${shape}`);
      }
    }
  }

  return lines.join('\n');
}

function idFromIndex(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  return String.fromCharCode(65 + Math.floor(i / 26) - 1) +
         String.fromCharCode(65 + (i % 26));
}

// CLI entry point
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/build-graph.mjs');

if (isMain) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.mappings || !args.config) {
    console.error('Missing required arguments: --mappings and --config');
    console.error(
      'Usage: node build-graph.mjs --workflows "glob" --mappings PATH --config PATH',
    );
    process.exit(2);
  }

  const idMappings = loadJson(args.mappings);
  const projectConfig = loadJson(args.config);

  // Read workflow files — the --workflows arg may be a single path or glob
  // In practice, the AI expands globs before passing to the script
  const wfPaths = args.workflows ? args.workflows.split(/\s+/) : [];
  const workflows = [];
  for (const p of wfPaths) {
    try {
      workflows.push(JSON.parse(readFileSync(p, 'utf-8')));
    } catch (e) {
      console.error(`Warning: could not read ${p}: ${e.message}`);
    }
  }

  const output = buildGraph(workflows, idMappings, projectConfig);
  console.log(JSON.stringify(output, null, 2));
}
