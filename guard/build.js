"use strict";

/**
 * Regenerates the per-tool guard artifacts from guard/policy.json (the single source of truth):
 *   guard/codex/lah.rules              Codex command rules
 *   guard/opencode/permission.json     OpenCode permission rules merged into opencode.json
 *   guard/{pi,claude}/lah-guard/policy.json and core.js
 *                                      copies each guard reads beside itself (deployed on its own)
 * Run `node guard/build.js` after editing the policy; the test suite fails when they drift.
 */

const fs = require("node:fs");
const path = require("node:path");

const POLICY_PATH = path.join(__dirname, "policy.json");
const CODEX_DECISION = { ask: "prompt", deny: "forbidden" };

/**
 * Codex rules match command prefixes only, so a flag after other arguments (git push origin --force)
 * is not seen; the Pi guard and Codex's own approval policy cover that case.
 *
 * @param {{shell: {command: string[], anyOf?: string[], decision: string, reason: string}[]}} policy
 * @returns {string}
 */
function renderCodex(policy) {
  const lines = [
    "# Generated from guard/policy.json by guard/build.js. Do not edit.",
    "# Codex rules match command prefixes only: a flag placed after other arguments is not seen.",
    "",
  ];
  for (const rule of policy.shell) {
    const patterns = rule.anyOf ? rule.anyOf.map((flag) => [...rule.command, flag]) : [rule.command];
    for (const pattern of patterns) {
      lines.push(
        "prefix_rule(",
        `    pattern = [${pattern.map((token) => JSON.stringify(token)).join(", ")}],`,
        `    decision = ${JSON.stringify(CODEX_DECISION[rule.decision])},`,
        `    justification = ${JSON.stringify(rule.reason)},`,
        ")",
        "",
      );
    }
  }
  return lines.join("\n");
}

/**
 * OpenCode applies the last matching rule, so the exception goes after the denies. Secret names are
 * patterns over the whole path (`*.env`), and a directory matches any path through it.
 *
 * @param {{basenames: string[], except: string[], directories: string[]}} secrets
 * @returns {Record<string, "allow" | "deny">}
 */
function openCodeSecretRules(secrets) {
  /** @type {Record<string, "allow" | "deny">} */
  const rules = {};
  const anywhere = (name) => (name.startsWith("*") ? name : `*${name}`);
  for (const name of secrets.basenames) rules[anywhere(name)] = "deny";
  for (const directory of secrets.directories) rules[`*/${directory}/*`] = "deny";
  for (const name of secrets.except) rules[anywhere(name)] = "allow";
  return rules;
}

/**
 * A flag can sit before or after other arguments (`git push origin --force`), so each flag gets the
 * four shapes the OpenCode wildcards can express. Rules without flags match the bare command too.
 *
 * @param {{command: string[], anyOf?: string[], decision: string}[]} shell
 * @returns {Record<string, string>}
 */
function openCodeShellRules(shell) {
  /** @type {Record<string, string>} */
  const rules = {};
  for (const rule of shell) {
    const command = rule.command.join(" ");
    const shapes = rule.anyOf
      ? rule.anyOf.flatMap((flag) => [`${command} ${flag}`, `${command} ${flag} *`, `${command} * ${flag}`, `${command} * ${flag} *`])
      : [command, `${command} *`];
    for (const shape of shapes) rules[shape] = rule.decision;
  }
  return rules;
}

/**
 * @param {Parameters<typeof renderCodex>[0] & {secrets: {basenames: string[], except: string[], directories: string[]}}} policy
 * @returns {{permission: {read: Record<string, string>, edit: Record<string, string>, bash: Record<string, string>}}}
 */
function renderOpenCode(policy) {
  return {
    permission: {
      read: openCodeSecretRules(policy.secrets),
      edit: openCodeSecretRules(policy.secrets),
      bash: openCodeShellRules(policy.shell),
    },
  };
}

function build() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
  fs.mkdirSync(path.join(__dirname, "codex"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "codex", "lah.rules"), renderCodex(policy));
  fs.mkdirSync(path.join(__dirname, "opencode"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "opencode", "permission.json"), `${JSON.stringify(renderOpenCode(policy), null, 2)}\n`);
  for (const tool of ["pi", "claude"]) {
    for (const shared of ["policy.json", "core.js"]) {
      fs.copyFileSync(path.join(__dirname, shared), path.join(__dirname, tool, "lah-guard", shared));
    }
  }
}

if (require.main === module) build();

module.exports = { renderCodex, renderOpenCode };
