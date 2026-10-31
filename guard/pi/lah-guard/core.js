"use strict";

/**
 * Policy matcher shared by every guard (Pi extension, Claude Code hook). guard/build.js copies this
 * file beside each of them, because each is deployed on its own.
 *
 * Best effort, not a sandbox: a command built through an interpreter (`python -c`) is not seen.
 */

const path = require("node:path");

const SEGMENT_SEPARATORS = /&&|\|\||[;|\n]/;

/**
 * Case-insensitive: the default macOS and Windows file systems open `.ENV` as `.env`.
 *
 * @param {string} pattern glob where `*` stands for any run of characters inside one path segment
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`, "i");
}

/** @param {string} word @returns {string} */
function unquote(word) {
  return word.replace(/^['"]+|['"]+$/g, "");
}

/**
 * Words of one shell segment, without leading VAR=value assignments.
 * @param {string} segment
 * @returns {string[]}
 */
function wordsOf(segment) {
  const words = segment.trim().split(/\s+/).filter(Boolean).map(unquote);
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
  return words;
}

/**
 * The executable a shell word runs: `/bin/CAT` is `cat` (the default macOS and Windows file systems ignore case).
 * @param {string} word
 * @returns {string}
 */
function executableOf(word) {
  return path.basename(word).toLowerCase();
}

const BRACE_GROUP = /\{([^{}]*)\}/;
const MAX_BRACE_VARIANTS = 256;

/**
 * Shell brace expansion, so `*.{env,pem}` and `{.env,x}` are checked as the names they stand for.
 * Growth is exponential in the number of groups, so past MAX_BRACE_VARIANTS it gives up.
 *
 * @param {string} text
 * @returns {string[] | null} the expanded names, or null when there are too many to check
 */
function expandBraces(text) {
  let variants = [text];
  for (;;) {
    const next = [];
    let expanded = false;
    for (const variant of variants) {
      const group = BRACE_GROUP.exec(variant);
      if (!group) {
        next.push(variant);
        continue;
      }
      expanded = true;
      const [whole, alternatives] = group;
      for (const alternative of alternatives.split(",")) {
        next.push(variant.slice(0, group.index) + alternative + variant.slice(group.index + whole.length));
      }
      if (next.length > MAX_BRACE_VARIANTS) return null;
    }
    if (!expanded) return next;
    variants = next;
  }
}

/** @param {string} command @returns {string[][]} */
function segmentsOf(command) {
  return command.split(SEGMENT_SEPARATORS).map(wordsOf).filter((words) => words.length > 0);
}

/**
 * @typedef {Object} ShellRule
 * @property {string[]} command
 * @property {string[]} [anyOf]
 * @property {"ask" | "deny"} decision
 * @property {string} reason
 *
 * @typedef {Object} Policy
 * @property {{basenames: string[], except: string[], directories: string[], readers: string[]}} secrets
 * @property {ShellRule[]} shell
 */

/**
 * @param {Policy} policy
 * @returns {{isSecretPath: (filePath: string) => boolean, readsSecret: (command: string) => boolean, ruleHit: (command: string) => ShellRule | undefined}}
 */
function createMatcher(policy) {
  const secretBasenames = policy.secrets.basenames.map(globToRegExp);
  const allowedBasenames = policy.secrets.except.map(globToRegExp);
  const secretDirectories = policy.secrets.directories.map((name) => name.toLowerCase());

  /** @param {string} filePath @returns {boolean} */
  function isSecretName(filePath) {
    const base = path.basename(filePath);
    if (allowedBasenames.some((pattern) => pattern.test(base))) return false;
    if (secretBasenames.some((pattern) => pattern.test(base))) return true;
    return filePath.split("/").some((part) => secretDirectories.includes(part.toLowerCase()));
  }

  /** @param {string} filePath @returns {boolean} */
  function isSecretPath(filePath) {
    const names = expandBraces(filePath);
    return names === null || names.some(isSecretName);
  }

  /** @param {string} command @returns {boolean} */
  function readsSecret(command) {
    return segmentsOf(command).some(
      ([first, ...args]) => policy.secrets.readers.includes(executableOf(first)) && args.some(isSecretPath),
    );
  }

  /**
   * @param {string} command
   * @returns {ShellRule | undefined} the first policy rule the command hits
   */
  function ruleHit(command) {
    for (const words of segmentsOf(command)) {
      for (const rule of policy.shell) {
        const matchesCommand = rule.command.every(
          (token, index) => (index === 0 ? executableOf(words[0]) : words[index]) === token,
        );
        if (!matchesCommand) continue;
        const rest = words.slice(rule.command.length);
        if (!rule.anyOf || rest.some((word) => rule.anyOf.includes(word))) return rule;
      }
    }
    return undefined;
  }

  return { isSecretPath, readsSecret, ruleHit };
}

module.exports = { createMatcher };
