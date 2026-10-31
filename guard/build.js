"use strict";

/**
 * Regenerates the per-tool guard artifacts from guard/policy.json (the single source of truth):
 *   guard/codex/lah.rules              Codex command rules
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

function build() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
  fs.mkdirSync(path.join(__dirname, "codex"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "codex", "lah.rules"), renderCodex(policy));
  for (const tool of ["pi", "claude"]) {
    for (const shared of ["policy.json", "core.js"]) {
      fs.copyFileSync(path.join(__dirname, shared), path.join(__dirname, tool, "lah-guard", shared));
    }
  }
}

if (require.main === module) build();

module.exports = { renderCodex };
