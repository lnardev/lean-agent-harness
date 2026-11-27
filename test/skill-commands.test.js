"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const { Repo, SKIP, featureBranch } = require("./git-repo.js");

/** @param {string} name @param {string} [file] @returns {string} the SKILL.md of a skill, or another of its files */
function skill(name, file = "SKILL.md") {
  return fs.readFileSync(path.join(PKG_ROOT, "skills", name, file), "utf8");
}

/**
 * Returns the one inline-code span of a skill that starts with a prefix, so the test runs the documented text.
 * @param {string} name skill folder
 * @param {string} prefix start of the command
 * @param {string} [file] the skill file that documents it
 * @returns {string} the command exactly as documented
 */
function documented(name, prefix, file) {
  const spans = [...skill(name, file).matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((span) => span.startsWith(prefix));
  assert.strictEqual(new Set(spans).size, 1, `${name} documents exactly one \`${prefix}…\` command, found ${JSON.stringify(spans)}`);
  return spans[0];
}

test("review-audit's diff hash is stable, moves on every edit, and sees new files only after git add -N", { skip: SKIP }, () => {
  const hash = documented("review-audit", "git diff HEAD |");
  assert.match(documented("review-audit", "git add -N"), /^git add -N </);
  const repo = new Repo();
  const clean = repo.sh(hash);
  assert.strictEqual(repo.sh(hash), clean, "same tree, same hash");
  repo.write("a.txt", "one\nTWO\n");
  const edited = repo.sh(hash);
  assert.notStrictEqual(edited, clean, "an edit to a tracked file moves the hash");
  repo.write("new.txt", "fresh\n");
  assert.strictEqual(repo.sh(hash), edited, "an untracked file is invisible without -N");
  repo.git("add", "-N", "new.txt");
  const intended = repo.sh(hash);
  assert.notStrictEqual(intended, edited, "git add -N brings the new file into the hash");
  repo.write("new.txt", "changed\n");
  assert.notStrictEqual(repo.sh(hash), intended, "an edit to an intent-added file moves the hash");
});

test("review-audit hashes the branch diff once the work is committed, since git diff HEAD is then empty", { skip: SKIP }, () => {
  const hash = documented("review-audit", "git diff HEAD |");
  const branchDiff = documented("review-audit", "git diff <base>...HEAD");
  const repo = new Repo();
  repo.git("switch", "-q", "-c", "feature/x");
  repo.write("a.txt", "one\nTWO\n");
  repo.git("commit", "-q", "-am", "work");
  assert.strictEqual(repo.git("diff", "HEAD"), "", "committed work leaves git diff HEAD empty");
  const emptyHash = repo.sh(hash);
  const branchHash = repo.sh(`${branchDiff.replace("<base>", "main")} | git hash-object --stdin`);
  assert.notStrictEqual(branchHash, emptyHash, "the branch diff carries the work");
  assert.match(repo.git("diff", "main...HEAD"), /\+TWO/);
});

test("commit's staged stat line reports insertions and deletions, including a deletion-only change", { skip: SKIP }, () => {
  const stat = documented("commit", "git diff --cached --stat");
  const repo = new Repo();
  repo.write("a.txt", "one\nTWO\nthree\n");
  repo.git("add", "a.txt");
  const last = (repo.sh(stat).split("\n").at(-1) ?? "").trim();
  assert.match(last, /^1 file changed, 2 insertions\(\+\), 1 deletion\(-\)$/);
  repo.git("commit", "-q", "-m", "edit");
  repo.git("rm", "-q", "a.txt");
  assert.match((repo.sh(stat).split("\n").at(-1) ?? "").trim(), /^1 file changed, 3 deletions\(-\)$/);
});

test("pull-request's per-commit hash equals the one review-audit recorded before each commit", { skip: SKIP }, () => {
  const recordHash = documented("review-audit", "git diff HEAD |");
  const intentToAdd = documented("review-audit", "git add -N");
  const commitHash = documented("pull-request", "git diff <commit>^ <commit> |");
  const repo = new Repo();
  repo.git("switch", "-q", "-c", "feature/x");
  repo.write("a.txt", "one\nTWO\n");
  const first = repo.sh(recordHash);
  repo.git("commit", "-q", "-am", "edit");
  repo.write("new.txt", "fresh\n");
  repo.sh(intentToAdd.replace("<new files>", "new.txt"));
  const second = repo.sh(recordHash);
  repo.git("add", "new.txt");
  repo.git("commit", "-q", "-m", "new file");
  const commits = repo.git("rev-list", "--reverse", "main..HEAD").trim().split("\n");
  const hashes = commits.map((commit) => repo.sh(commitHash.replaceAll("<commit>", commit)));
  assert.deepStrictEqual(hashes, [first, second]);
});

test("pull-request's branch hash equals review-audit's for work reviewed once and committed in two parts", { skip: SKIP }, () => {
  const recordHash = documented("review-audit", "git diff HEAD |");
  const committedDiff = documented("review-audit", "git diff <base>...HEAD");
  const branchHash = documented("pull-request", "git diff refs/remotes/origin/<base>...HEAD |").replace("<base>", "main");
  const repo = new Repo();
  repo.git("update-ref", "refs/remotes/origin/main", "main");
  repo.git("switch", "-q", "-c", "feature/x");
  repo.write("a.txt", "one\nTWO\n");
  repo.write("new.txt", "fresh\n");
  repo.git("add", "-N", "new.txt");
  const reviewed = repo.sh(recordHash);
  repo.git("commit", "-q", "-m", "edit", "a.txt");
  repo.git("add", "new.txt");
  repo.git("commit", "-q", "-m", "new file");
  repo.git("branch", "origin/main");
  assert.strictEqual(repo.sh(branchHash), reviewed, "the uncommitted review, with a local branch named origin/main");
  assert.strictEqual(repo.sh(branchHash), repo.sh(`${committedDiff.replace("<base>", "main")} | git hash-object --stdin`), "the review of committed work");
});

/** @param {Repo} repo @returns {Record<string, string>} the commit of every ref on origin */
function originRefs(repo) {
  const lines = repo.git("ls-remote", "--refs", "origin").trim().split("\n");
  return Object.fromEntries(lines.map((line) => line.split("\t").reverse()));
}

/** @returns {string} the documented push of feature/x */
function documentedPush() {
  return documented("pull-request", "git push", "references/publish.md").replaceAll("<branch>", "feature/x");
}

test("pull-request's push creates the same-named branch and leaves the base alone under push.default=upstream", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("config", "push.default", "upstream");
  const base = originRefs(repo)["refs/heads/main"];
  repo.sh(documentedPush());
  assert.deepStrictEqual(originRefs(repo), { "refs/heads/main": base, "refs/heads/feature/x": repo.git("rev-parse", "HEAD").trim() });
  assert.strictEqual(repo.git("rev-parse", "--abbrev-ref", "feature/x@{upstream}").trim(), "origin/feature/x");
});

test("pull-request's push is rejected on a diverged branch even when git config asks to force it", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("push", "-q", "origin", "refs/heads/feature/x:refs/heads/feature/x");
  repo.git("commit", "-q", "--amend", "-m", "rewritten");
  repo.git("config", "remote.origin.push", "+refs/heads/*:refs/heads/*");
  const before = originRefs(repo);
  const push = repo.run(documentedPush());
  assert.notStrictEqual(push.status, 0, push.stderr);
  assert.match(push.stderr, /\[rejected\]/);
  assert.deepStrictEqual(originRefs(repo), before);
});

test("pull-request's push sends no tag even when git config follows tags", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("tag", "-a", "local-only", "-m", "note");
  repo.git("config", "push.followTags", "true");
  repo.sh(documentedPush());
  assert.deepStrictEqual(Object.keys(originRefs(repo)).sort(), ["refs/heads/feature/x", "refs/heads/main"]);
});
