#!/usr/bin/env node
"use strict";

/**
 * Registers the lah guard hook in a Claude Code settings.json without touching anything else.
 * Used by bin/cli.js (require) and install.sh (`node merge-settings.js <hook.json> <settings.json>`).
 *
 * A settings.json that is not valid JSON, or whose `hooks` have an unexpected shape, is never
 * modified. When the file changes, the previous one is kept as "<name>.bak" (or the next free .bak.N).
 */

const fs = require("node:fs");
const path = require("node:path");

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {string} settingsPath
 * @returns {{raw: string | null, settings: Record<string, unknown>}} raw is null when the file does not exist yet
 */
function readSettings(settingsPath) {
  let raw = null;
  try {
    raw = fs.readFileSync(settingsPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (raw === null) return { raw, settings: {} };

  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${settingsPath} is not valid JSON (${err.message}); fix it and run again`);
  }
  if (!isObject(settings)) throw new Error(`${settingsPath} is not a JSON object; fix it and run again`);
  return { raw, settings };
}

/** @param {string} settingsPath */
function keepBackup(settingsPath) {
  let backup = `${settingsPath}.bak`;
  for (let n = 1; fs.existsSync(backup); n++) backup = `${settingsPath}.bak.${n}`;
  fs.copyFileSync(settingsPath, backup);
}

/**
 * @param {string} hookPath JSON file with {event, entry}
 * @param {string} settingsPath
 * @returns {boolean} true when settings.json was written
 */
function mergeHook(hookPath, settingsPath) {
  const { event, entry } = JSON.parse(fs.readFileSync(hookPath, "utf8"));
  const { raw, settings } = readSettings(settingsPath);

  const hooks = settings.hooks ?? {};
  const entries = isObject(hooks) ? hooks[event] ?? [] : null;
  if (!Array.isArray(entries)) {
    throw new Error(`${settingsPath} has an unexpected "hooks" shape; fix it and run again`);
  }

  const command = entry.hooks[0].command;
  const registered = entries.some((existing) => Array.isArray(existing?.hooks) && existing.hooks.some((hook) => hook?.command === command));
  if (registered) return false;

  if (raw !== null) keepBackup(settingsPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify({ ...settings, hooks: { ...hooks, [event]: [...entries, entry] } }, null, 2)}\n`);
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
