"use strict";

/**
 * Read and write a JSON config file that belongs to the user (Claude Code settings.json, OpenCode
 * opencode.json) without ever damaging it. Shared by guard/claude/merge-settings.js and
 * guard/opencode/merge-permission.js.
 *
 * A file that is not valid JSON, or not a JSON object, is never modified. When a write changes an
 * existing file, the previous one is kept as "<name>.bak" (or the next free .bak.N).
 */

const fs = require("node:fs");
const path = require("node:path");

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {string} filePath
 * @returns {{raw: string | null, value: Record<string, unknown>}} raw is null when the file does not exist yet
 */
function readJsonObject(filePath) {
  let raw = null;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (raw === null) return { raw, value: {} };

  let value;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${filePath} is not valid JSON (${err.message}); fix it and run again`);
  }
  if (!isObject(value)) throw new Error(`${filePath} is not a JSON object; fix it and run again`);
  return { raw, value };
}

/**
 * @param {string} filePath
 * @param {string | null} raw what readJsonObject returned: null means there is nothing to back up
 * @param {Record<string, unknown>} value
 */
function writeJsonObject(filePath, raw, value) {
  if (raw !== null) {
    let backup = `${filePath}.bak`;
    for (let n = 1; fs.existsSync(backup); n++) backup = `${filePath}.bak.${n}`;
    fs.copyFileSync(filePath, backup);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

module.exports = { isObject, readJsonObject, writeJsonObject };
