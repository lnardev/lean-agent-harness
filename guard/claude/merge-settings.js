#!/usr/bin/env node
"use strict";

/**
 * Registers the lah guard hook in a Claude Code settings.json without touching anything else.
 * Used by bin/cli.js (require) and install.sh (`node merge-settings.js <hook.json> <settings.json>`).
 *
 * A settings.json whose `hooks` have an unexpected shape is never modified (see json-config.js for
 * the invalid-JSON and backup rules).
 */

const fs = require("node:fs");
const { isObject, readJsonObject, writeJsonObject } = require("../json-config.js");

/**
 * @param {string} hookPath JSON file with {event, entry}
 * @param {string} settingsPath
 * @returns {boolean} true when settings.json was written
 */
function mergeHook(hookPath, settingsPath) {
  const { event, entry } = JSON.parse(fs.readFileSync(hookPath, "utf8"));
  const { raw, value: settings } = readJsonObject(settingsPath);

  const hooks = settings.hooks ?? {};
  const entries = isObject(hooks) ? hooks[event] ?? [] : null;
  if (!Array.isArray(entries)) {
    throw new Error(`${settingsPath} has an unexpected "hooks" shape; fix it and run again`);
  }

  const command = entry.hooks[0].command;
  const registered = entries.some((existing) => Array.isArray(existing?.hooks) && existing.hooks.some((hook) => hook?.command === command));
  if (registered) return false;

  writeJsonObject(settingsPath, raw, { ...settings, hooks: { ...hooks, [event]: [...entries, entry] } });
  return true;
}

if (require.main === module) {
  try {
    mergeHook(process.argv[2], process.argv[3]);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { mergeHook };
