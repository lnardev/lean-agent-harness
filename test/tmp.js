"use strict";

const { after } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** @type {string[]} directories created by this test file, removed when it ends */
const created = [];

after(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Creates a fresh temp directory that is removed when the test file ends, even if a test fails.
 * @param {string} prefix name prefix, such as `lah-mem-`
 * @returns {string} the real path of the new directory
 */
function tmpDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  created.push(dir);
  return dir;
}

module.exports = { tmpDir };
