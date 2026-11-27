"use strict";

const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { isolatedEnv } = require("./git-env.js");
const { tmpDir } = require("./tmp.js");

/** Isolated from inherited GIT_* variables, the user's git config, hooks and signing, with a fixed identity. */
const GIT_ENV = isolatedEnv();
const SPAWN_TIMEOUT_MS = 30000;
const SKIP = spawnSync("git", ["--version"], { env: GIT_ENV }).status === 0 ? false : "git is not on PATH";

/** A throwaway repository with one committed file, removed when the test file ends. */
class Repo {
  constructor() {
    this.root = tmpDir("lah-git-");
    this.git("init", "-q", "-b", "main");
    this.write("a.txt", "one\ntwo\n");
    this.git("add", "a.txt");
    this.git("commit", "-q", "-m", "base");
  }

  /** @param {...string} args @returns {string} stdout */
  git(...args) {
    const res = spawnSync("git", args, { cwd: this.root, env: GIT_ENV, encoding: "utf8", timeout: SPAWN_TIMEOUT_MS });
    assert.strictEqual(res.status, 0, `git ${args.join(" ")}: ${res.stderr}`);
    return res.stdout;
  }

  /** @param {string} file path inside the repository @param {string} content */
  write(file, content) {
    const target = path.join(this.root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  /** @param {string} file writes it and commits it alone, with the file name as subject */
  commit(file) {
    this.write(file, `${file}\n`);
    this.git("add", file);
    this.git("commit", "-q", "-m", file);
  }

  /** @param {string} command a documented shell pipeline, run verbatim */
  run(command) {
    return spawnSync("sh", ["-c", command], { cwd: this.root, env: GIT_ENV, encoding: "utf8", timeout: SPAWN_TIMEOUT_MS });
  }

  /** @param {string} command a documented shell pipeline, run verbatim @returns {string} trimmed stdout */
  sh(command) {
    const res = this.run(command);
    assert.strictEqual(res.status, 0, `${command}: ${res.stderr}`);
    return res.stdout.trim();
  }
}

/**
 * @param {string} [defaultBranch] the default branch of origin
 * @returns {Repo} a repository whose origin is a local bare repository, on feature/x with one commit ahead
 */
function featureBranch(defaultBranch = "main") {
  const remote = tmpDir("lah-remote-");
  const repo = new Repo();
  repo.git("branch", "-q", "-M", defaultBranch);
  repo.git("init", "-q", "--bare", "-b", defaultBranch, remote);
  repo.git("remote", "add", "origin", remote);
  repo.git("push", "-q", "origin", defaultBranch);
  repo.git("switch", "-q", "-c", "feature/x", "--track", `origin/${defaultBranch}`);
  repo.write("a.txt", "one\nTWO\n");
  repo.git("commit", "-q", "-am", "work");
  return repo;
}

module.exports = { Repo, SKIP, featureBranch };
