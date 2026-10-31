#!/usr/bin/env node
"use strict";

/**
 * Merges the lah guard permissions into an OpenCode opencode.json without touching anything else.
 * Used by bin/cli.js (require) and install.sh (`node merge-permission.js <permission.json> <opencode.json>`).
 *
 * OpenCode applies the last matching rule, so each of our patterns is moved to the end of its tool's
 * rules: it replaces a user rule with the same pattern and wins over earlier, broader ones. A text
 * value such as `"permission": "allow"` or `"read": "allow"` is kept as `{"*": "allow"}`.
 * See json-config.js for the invalid-JSON and backup rules.
 */

const fs = require("node:fs");
const { isObject, readJsonObject, writeJsonObject } = require("../json-config.js");

/**
 * @param {unknown} value a `permission` or `permission.<tool>` value from the user's config
 * @param {string} where for the error message
 * @returns {Record<string, unknown>} the same rules as an object
 */
function asRules(value, where) {
  if (value === undefined) return {};
  if (typeof value === "string") return { "*": value };
  if (isObject(value)) return { ...value };
  throw new Error(`${where} has an unexpected shape; fix it and run again`);
}

/**
 * @param {string} fragmentPath JSON file with {permission: {<tool>: {<pattern>: <decision>}}}
 * @param {string} configPath
 * @returns {boolean} true when opencode.json was written
 */
function mergePermission(fragmentPath, configPath) {
  const { permission: ours } = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));
  const { raw, value: config } = readJsonObject(configPath);

  const permission = asRules(config.permission, `${configPath} "permission"`);
  for (const [tool, rules] of Object.entries(ours)) {
    const merged = asRules(permission[tool], `${configPath} "permission.${tool}"`);
    for (const [pattern, decision] of Object.entries(rules)) {
      delete merged[pattern];
      merged[pattern] = decision;
    }
    permission[tool] = merged;
  }

  const next = { ...config, permission };
  if (JSON.stringify(next) === JSON.stringify(config)) return false;
  writeJsonObject(configPath, raw, next);
  return true;
}

if (require.main === module) {
  try {
    mergePermission(process.argv[2], process.argv[3]);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { mergePermission };
