#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

/**
 * @typedef {{ sha: string, subject: string }} Commit
 * @typedef {{ branch: string | null, base: string | null, origin: boolean, commits: Commit[], untracked: string[], secrets: string[], blockers: string[] }} Report
 */

const USAGE = "usage: preflight.js [--base <branch>]";
/** No leading `+` or `-`, no shell syntax: such a name is safe as an argument and inside a refspec. */
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
/** Folders the harness writes in a project; untracked, they are never part of a change. */
const STATE_DIRS = [".tasks/", ".memory/"];
const LOCAL_BASES = ["main", "master"];
/** File names that, on their own, say a file holds a secret; compared in lower case. */
const SECRET_NAME = /^(\.env.*|.*\.(pem|key)|id_(rsa|dsa|ecdsa|ed25519).*)$/s;
/** The names among those that hold none: the example environment file, public SSH keys and source files such as `id_rsa_test.go`. */
const HARMLESS_NAME = /^(\.env\.example|id_.*\.(pub|c|cjs|cpp|cs|go|h|java|js|jsx|kt|mjs|php|py|rb|rs|swift|ts|tsx))$/s;
const SECRET_DIRECTORY = ".ssh";
const TIMEOUT_MS = 60000;
const MAX_BUFFER = 64 * 1024 * 1024;

/** @param {string} text @returns {string} the text without the user or token of any URL */
function redact(text) {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s'"]*@/gi, "$1");
}

/** @param {string[]} args runs git without a shell, stdin or prompts, on the real objects (no replace refs) */
function tryGit(args) {
  return spawnSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
}

/** @param {...string} args @returns {string} stdout; throws when git fails */
function git(...args) {
  const res = tryGit(args);
  if (res.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${redact(res.error?.message ?? res.stderr.trim())}`);
  }
  return res.stdout;
}

/** @param {string} ref @returns {boolean} whether the ref names a commit here */
function hasCommit(ref) {
  return tryGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0;
}

/** @param {Report} report fills the untracked files and blocks on tracked changes */
function readTree(report) {
  const entries = git("status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames").split("\0").filter(Boolean);
  const untracked = entries.filter((entry) => entry.startsWith("?? ")).map((entry) => entry.slice(3));
  report.untracked = untracked.filter((file) => !STATE_DIRS.some((dir) => file.startsWith(dir)));
  if (untracked.length < entries.length) report.blockers.push("uncommitted changes");
}

/** @returns {string | null} the default branch of origin, read from the remote itself */
function originDefault() {
  return git("ls-remote", "--symref", "origin", "HEAD").match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1] ?? null;
}

/** @param {string} branch @returns {boolean} whether origin has exactly this branch */
function onOrigin(branch) {
  const ref = `refs/heads/${branch}`;
  return git("ls-remote", "--heads", "origin", ref).split("\n").some((line) => line.split("\t")[1] === ref);
}

/**
 * @param {Report} report
 * @param {string | null} requested the branch given with --base
 * @returns {string | null} the ref to compare with, or null once a blocker says why there is none
 */
function resolveBase(report, requested) {
  const fallback = report.origin ? originDefault() : (LOCAL_BASES.find((name) => hasCommit(`refs/heads/${name}`)) ?? null);
  const base = requested ?? fallback;
  if (base === null) {
    report.blockers.push("cannot determine the base branch; pass --base");
    return null;
  }
  if (!SAFE_BRANCH.test(base)) {
    report.blockers.push("unsafe base branch name");
    return null;
  }
  report.base = base;
  if (report.branch === base || report.branch === fallback) {
    report.blockers.push("the current branch is the base or the default branch");
  }
  return report.origin ? fetchBase(report, base) : localBase(report, base);
}

/**
 * Updates only the remote-tracking ref of the base: `--refmap=` keeps a configured refspec away from local branches.
 * @param {Report} report @param {string} base @returns {string | null}
 */
function fetchBase(report, base) {
  if (!onOrigin(base)) {
    report.blockers.push(`base ${base} is not a branch of origin`);
    return null;
  }
  const ref = `refs/remotes/origin/${base}`;
  git("fetch", "--quiet", "--refmap=", "--no-tags", "--no-recurse-submodules", "origin", `+refs/heads/${base}:${ref}`);
  return ref;
}

/** @param {Report} report @param {string} base @returns {string | null} */
function localBase(report, base) {
  const ref = `refs/heads/${base}`;
  if (hasCommit(ref)) return ref;
  report.blockers.push(`base ${base} is not a local branch`);
  return null;
}

/** @param {Report} report @param {string} ref the base; fills the commits ahead of it, oldest first */
function readCommits(report, ref) {
  const log = git("log", "--no-show-signature", "--reverse", "-z", "--format=%H%x09%s", `${ref}..HEAD`);
  report.commits = log.split("\0").filter(Boolean).map((entry) => {
    const [sha, ...subject] = entry.split("\t");
    return { sha, subject: subject.join("\t") };
  });
  if (report.commits.length === 0) report.blockers.push(`no commits ahead of ${report.base}`);
}

/** @param {string} file a repository path @returns {boolean} whether the path alone says it holds a secret */
function isSecretPath(file) {
  const directories = file.toLowerCase().split("/");
  const name = directories.pop() ?? "";
  return directories.includes(SECRET_DIRECTORY) || (SECRET_NAME.test(name) && !HARMLESS_NAME.test(name));
}

/**
 * A push sends history, so every commit ahead counts, not only the final tree. Deletions are left out:
 * removing a secret that the base already has sends nothing new. The flags keep git config from hiding a path.
 * `--no-renames` also stops git from reading file contents, which is slow and downloads blobs in a partial clone.
 * @param {Report} report @param {string} ref the base
 */
function readSecrets(report, ref) {
  const paths = git(
    "log", "--no-show-signature", "--root", "--no-relative", "--no-renames", "--diff-filter=d",
    "--diff-merges=dense-combined", "--name-only", "--format=", "-z", `${ref}..HEAD`,
  );
  report.secrets = [...new Set(paths.split("\0").filter(isSecretPath))].sort();
  if (report.secrets.length > 0) report.blockers.push("secret file in the commits to push");
}

/**
 * Reads the state of the current branch. Its only write is the remote-tracking ref of the base.
 * @param {string | null} requested the branch given with --base
 * @returns {Report}
 */
function inspect(requested) {
  /** @type {Report} */
  const report = { branch: null, base: null, origin: false, commits: [], untracked: [], secrets: [], blockers: [] };
  report.origin = git("remote").split("\n").includes("origin");
  // Only git's newline is removed: trim() would also drop characters such as U+00A0 and name another branch.
  const branch = git("branch", "--show-current").replace(/\n$/, "");
  if (!SAFE_BRANCH.test(branch)) {
    report.blockers.push("unsafe branch name or detached HEAD");
    return report;
  }
  report.branch = branch;
  readTree(report);
  const ref = resolveBase(report, requested);
  if (ref !== null) {
    readCommits(report, ref);
    readSecrets(report, ref);
  }
  return report;
}

/** @param {string[]} argv @returns {number} 0 when the report was printed, even with blockers */
function main(argv) {
  const named = argv.length === 2 && argv[0] === "--base";
  if (argv.length > 0 && !named) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(inspect(named ? argv[1] : null), null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`preflight: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
