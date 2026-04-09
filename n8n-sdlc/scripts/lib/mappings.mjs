/**
 * Shared id-mappings and config lookup utilities.
 * Zero dependencies — Node.js built-ins only.
 */

import { readFileSync } from 'node:fs';

/**
 * Read and parse a JSON file.
 * @param {string} filePath - Absolute or relative path to JSON file.
 * @returns {object} Parsed JSON.
 */
export function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Find a workflow mapping entry by its DEV ID.
 * @param {object} mappings - Parsed id-mappings.json.
 * @param {string} devId - The dev.id to search for.
 * @returns {[string, object]|null} [logicalName, entry] or null.
 */
export function findMappingByDevId(mappings, devId) {
  for (const [name, entry] of Object.entries(mappings.workflows)) {
    if (entry.dev?.id === devId) return [name, entry];
  }
  return null;
}

/**
 * Find a workflow mapping entry by its PROD ID.
 * @param {object} mappings - Parsed id-mappings.json.
 * @param {string} prodId - The prod.id to search for.
 * @returns {[string, object]|null} [logicalName, entry] or null.
 */
export function findMappingByProdId(mappings, prodId) {
  for (const [name, entry] of Object.entries(mappings.workflows)) {
    if (entry.prod?.id === prodId) return [name, entry];
  }
  return null;
}

/**
 * Check whether a workflow ID belongs to an external dependency.
 * @param {object} mappings - Parsed id-mappings.json.
 * @param {string} id - Workflow ID to check.
 * @returns {boolean}
 */
export function isExternalDependency(mappings, id) {
  if (!mappings.externalDependencies) return false;
  return Object.values(mappings.externalDependencies).some(
    (dep) => dep.id === id,
  );
}

/**
 * Get the dev prefix from project config.
 * @param {object} config - Parsed project.json.
 * @returns {string}
 */
export function getDevPrefix(config) {
  return config.naming.devPrefix;
}

/**
 * Get credential mappings from project config.
 * @param {object} config - Parsed project.json.
 * @returns {object} Alias-to-{dev,prod} map, or empty object.
 */
export function getCredentialMappings(config) {
  return config.credentials || {};
}

/**
 * Parse CLI arguments into a key-value map.
 * Supports --key value and --key=value forms.
 * @param {string[]} argv - Process arguments (typically process.argv.slice(2)).
 * @returns {object} Parsed argument map.
 */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
    } else {
      args[arg.slice(2)] = argv[++i];
    }
  }
  return args;
}
