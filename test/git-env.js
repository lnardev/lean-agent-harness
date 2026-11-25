"use strict";

const os = require("node:os");

/**
 * Environment for a git child process in a test: no inherited GIT_* variable (a git hook exports GIT_DIR,
 * GIT_WORK_TREE and GIT_INDEX_FILE, which would redirect the test's git calls into the hook's repository),
 * no global or system config, C locale for stable output, and a fixed identity.
 * @param {NodeJS.ProcessEnv} [source] the environment to start from
 * @returns {NodeJS.ProcessEnv}
 */
function isolatedEnv(source = process.env) {
  const base = Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith("GIT_")));
  return {
    ...base,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    LC_ALL: "C",
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
}

module.exports = { isolatedEnv };
