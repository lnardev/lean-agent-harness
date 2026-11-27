"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");
const { isolatedEnv } = require("./git-env.js");
const { Repo, SKIP, featureBranch } = require("./git-repo.js");
const { tmpDir } = require("./tmp.js");

const SCRIPT = path.join(PKG_ROOT, "skills", "pull-request", "scripts", "preflight.js");

/**
 * @param {string} cwd
 * @param {string[]} [args]
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(cwd, args = [], env = isolatedEnv()) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env, encoding: "utf8", timeout: 30000 });
}

/** @param {Repo} repo @param {...string} args @returns {any} the report of a run that must exit 0 */
function report(repo, ...args) {
  const res = run(repo.root, args);
  assert.strictEqual(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

/** @param {any} result @returns {string[]} the commit subjects of a report */
function subjects(result) {
  return result.commits.map((/** @type {{ subject: string }} */ commit) => commit.subject);
}

test("preflight reports a clean feature branch against the default branch", { skip: SKIP }, () => {
  const repo = featureBranch();
  assert.deepStrictEqual(report(repo), {
    branch: "feature/x",
    base: "main",
    origin: true,
    commits: [{ sha: repo.git("rev-parse", "HEAD").trim(), subject: "work" }],
    untracked: [],
    secrets: [],
    blockers: [],
  });
});

test("preflight ignores the untracked state folders of the harness and lists other untracked files", { skip: SKIP }, () => {
  const repo = featureBranch();
  for (const file of [".tasks/current.md", ".memory/index.md", "notes/to do ñ.txt"]) repo.write(file, "x\n");
  const result = JSON.parse(run(path.join(repo.root, "notes")).stdout);
  assert.deepStrictEqual(result.untracked, ["notes/to do ñ.txt"]);
  assert.deepStrictEqual(result.blockers, []);
});

test("preflight blocks on uncommitted changes to tracked files", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.write("a.txt", "edited\n");
  assert.deepStrictEqual(report(repo).blockers, ["uncommitted changes"]);
  repo.git("add", "a.txt");
  assert.deepStrictEqual(report(repo).blockers, ["uncommitted changes"]);
});

for (const name of ["master", "develop"]) {
  test(`preflight reads the default branch of origin when it is ${name}, listing commits oldest first`, { skip: SKIP }, () => {
    const repo = featureBranch(name);
    repo.commit("later.txt");
    const result = report(repo);
    assert.strictEqual(result.base, name);
    assert.deepStrictEqual(subjects(result), ["work", "later.txt"]);
  });
}

test("preflight takes --base from origin and blocks one that is missing or unsafe", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("push", "-q", "origin", "main:refs/heads/release/1.x");
  assert.strictEqual(report(repo, "--base", "release/1.x").base, "release/1.x");
  assert.deepStrictEqual(report(repo, "--base", "draft").blockers, ["base draft is not a branch of origin"]);
  assert.deepStrictEqual(report(repo, "--base", "+main").blockers, ["unsafe base branch name"]);
});

test("preflight refuses any other argument", { skip: SKIP }, () => {
  const repo = featureBranch();
  for (const args of [["draft"], ["--base"], ["--base", "main", "draft"], ["--other", "main"]]) {
    const res = run(repo.root, args);
    assert.strictEqual(res.status, 2, args.join(" "));
    assert.match(res.stderr, /usage: preflight\.js \[--base <branch>\]/);
    assert.strictEqual(res.stdout, "");
  }
});

test("preflight blocks a branch with no commits ahead of the base", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("reset", "-q", "--keep", "origin/main");
  assert.deepStrictEqual(report(repo).blockers, ["no commits ahead of main"]);
});

test("preflight blocks the base branch and the default branch", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("push", "-q", "origin", "main:refs/heads/develop");
  repo.git("push", "-q", "origin", "refs/heads/feature/x:refs/heads/feature/x");
  const blocker = "the current branch is the base or the default branch";
  assert.ok(report(repo, "--base", "feature/x").blockers.includes(blocker));
  repo.git("switch", "-q", "main");
  assert.ok(report(repo, "--base", "develop").blockers.includes(blocker));
});

test("preflight stops before fetching on an unsafe branch name or a detached HEAD", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("update-ref", "-d", "refs/remotes/origin/main");
  const changes = [
    ["switch", "-q", "-c", "+victim"],
    ["switch", "-q", "-c", "f/$(touch${IFS}PWNED)"],
    ["switch", "-q", "-c", "feature/x\u00a0"],
    ["switch", "-q", "--detach"],
  ];
  for (const change of changes) {
    repo.git(...change);
    const result = report(repo);
    assert.deepStrictEqual([result.branch, result.blockers], [null, ["unsafe branch name or detached HEAD"]], change.join(" "));
  }
  assert.strictEqual(repo.git("for-each-ref", "refs/remotes/origin/main"), "");
});

test("preflight lists the commits against another base in a single-branch clone", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("push", "-q", "origin", "main:refs/heads/develop");
  repo.git("update-ref", "-d", "refs/remotes/origin/develop");
  repo.git("config", "remote.origin.fetch", "+refs/heads/main:refs/remotes/origin/main");
  assert.deepStrictEqual(subjects(report(repo, "--base", "develop")), ["work"]);
});

test("preflight changes no local branch under a mirror-style fetch refspec", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("switch", "-q", "main");
  repo.commit("local-only.txt");
  repo.git("switch", "-q", "feature/x");
  repo.git("config", "remote.origin.fetch", "+refs/heads/*:refs/heads/*");
  repo.git("config", "fetch.prune", "true");
  const before = repo.git("for-each-ref", "refs/heads");
  report(repo);
  assert.strictEqual(repo.git("for-each-ref", "refs/heads"), before);
});

test("preflight without origin compares against --base, main or master, and blocks without any", { skip: SKIP }, () => {
  const repo = new Repo();
  repo.git("switch", "-q", "-c", "feature/x");
  repo.commit("work.txt");
  /** @type {[string, string, string[]][]} each rename of the base, and the arguments that then find it */
  const bases = [["main", "main", []], ["main", "master", []], ["master", "trunk", ["--base", "trunk"]]];
  for (const [from, base, args] of bases) {
    repo.git("branch", "-q", "-M", from, base);
    const result = report(repo, ...args);
    assert.deepStrictEqual([result.origin, result.base, subjects(result), result.blockers], [false, base, ["work.txt"], []], base);
  }
  assert.deepStrictEqual(report(repo).blockers, ["cannot determine the base branch; pass --base"]);
});

test("preflight exits 2 without printing the credentials of a failing remote", () => {
  const shim = tmpDir("lah-shim-");
  fs.writeFileSync(path.join(shim, "git"), "#!/bin/sh\necho \"fatal: unable to access 'https://user:placeholder@example.invalid/r.git/'\" >&2\nexit 128\n", { mode: 0o755 });
  const res = run(shim, [], { ...isolatedEnv(), PATH: shim });
  assert.strictEqual(res.status, 2);
  assert.match(res.stderr, /https:\/\/example\.invalid\/r\.git/);
  assert.doesNotMatch(res.stderr, /placeholder/);
});

test("preflight runs when installed inside a project whose package.json declares ES modules", { skip: SKIP }, () => {
  const repo = featureBranch();
  const installed = path.join(".claude", "skills", "pull-request", "scripts");
  repo.write("package.json", '{ "type": "module" }\n');
  fs.cpSync(path.dirname(SCRIPT), path.join(repo.root, installed), { recursive: true });
  const res = spawnSync(process.execPath, [path.join(installed, "preflight.js")], { cwd: repo.root, env: isolatedEnv(), encoding: "utf8", timeout: 30000 });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(JSON.parse(res.stdout).branch, "feature/x");
});

const SECRET_BLOCKER = "secret file in the commits to push";

/** @param {Repo} repo removes the file in a commit of its own */
function remove(repo, /** @type {string} */ file) {
  repo.git("rm", "-q", file);
  repo.git("commit", "-q", "-m", `remove ${file}`);
}

test("preflight lists secret files the history carries, also removed or merged in, but not the removal of one on the base", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("switch", "-q", "main");
  repo.commit("old.pem");
  repo.git("push", "-q", "origin", "main");
  repo.git("switch", "-q", "-c", "side");
  repo.commit("b.txt");
  repo.git("switch", "-q", "feature/x");
  repo.git("merge", "-q", "--no-edit", "main");
  remove(repo, "old.pem");
  repo.commit("dummy.pem");
  remove(repo, "dummy.pem");
  repo.git("merge", "-q", "--no-ff", "--no-commit", "side");
  repo.write("merge.key", "placeholder\n");
  repo.git("add", "merge.key");
  repo.git("commit", "-q", "-m", "merge");
  const result = report(repo);
  assert.deepStrictEqual(result.secrets, ["dummy.pem", "merge.key"]);
  assert.deepStrictEqual(result.blockers, [SECRET_BLOCKER]);
});

test("preflight does not list the files a merge of the base brings in", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.git("switch", "-q", "main");
  repo.commit("base-only.pem");
  repo.git("push", "-q", "origin", "main");
  repo.git("switch", "-q", "feature/x");
  repo.git("merge", "-q", "--no-edit", "main");
  assert.deepStrictEqual(report(repo).secrets, []);
});

test("preflight flags every secret name of the guard policy and the other SSH keys", { skip: SKIP }, () => {
  const policy = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "guard", "policy.json"), "utf8")).secrets;
  const names = [
    ...policy.basenames.map((/** @type {string} */ pattern) => pattern.replace("*", "x")),
    ...policy.directories.map((/** @type {string} */ directory) => `${directory}/known`),
    ...["id_dsa", "id_ecdsa", "id_ed25519_work", "id_ed25519_sk", "id_rsa.bak", "id_rsa.old", "id_rsa_github.com", "deploy/.ENV", "certs/Key.PEM", "home/.SSH/config", ".envrc", "cl\u00e9s \u00f1/to do.key"],
  ];
  const repo = featureBranch();
  for (const name of names) repo.write(name, "placeholder\n");
  repo.git("add", "--force", ...names);
  repo.git("commit", "-q", "-m", "names");
  assert.deepStrictEqual(report(repo).secrets, [...names].sort());
});

test("preflight accepts the example environment file, public keys and ordinary names", { skip: SKIP }, () => {
  const repo = featureBranch();
  for (const name of [...[".env.example", "app/.ENV.EXAMPLE", "id_rsa.pub", "id_ed25519_work.pub"], ...["environment.md", "keys.js", "pem/readme", "src/id_rsa_test.go", "id_ecdsa.py", "lib/id_ed25519.rs"]]) {
    repo.commit(name);
  }
  const result = report(repo);
  assert.deepStrictEqual([result.secrets, result.blockers], [[], []]);
});

test("preflight lists a secret that a later commit renamed to a harmless name", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.commit("dummy.key");
  repo.git("mv", "dummy.key", "notes.txt");
  repo.git("commit", "-q", "-m", "rename");
  assert.deepStrictEqual(report(repo).secrets, ["dummy.key"]);
});

test("preflight sees every path whatever git config says", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.commit("top.pem");
  repo.write("sub/file.txt", "x\n");
  repo.git("add", "sub/file.txt");
  repo.git("commit", "-q", "-m", "sub");
  repo.git("config", "diff.relative", "true");
  repo.git("config", "log.showRoot", "false");
  assert.deepStrictEqual(JSON.parse(run(path.join(repo.root, "sub")).stdout).secrets, ["top.pem"]);
  repo.git("switch", "-q", "--orphan", "unrelated");
  repo.commit("root.pem");
  assert.deepStrictEqual(report(repo).secrets, ["root.pem"]);
});

test("preflight scans the commits that would be pushed, not their local replacements", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.commit("dummy.pem");
  const real = repo.git("rev-parse", "HEAD").trim();
  const empty = repo.git("commit-tree", "HEAD~1^{tree}", "-p", "HEAD~1", "-m", "clean").trim();
  repo.git("replace", real, empty);
  assert.deepStrictEqual(report(repo).secrets, ["dummy.pem"]);
});

test("preflight is not fooled by a local branch named like the remote base", { skip: SKIP }, () => {
  const repo = featureBranch();
  repo.commit("dummy.pem");
  repo.git("branch", "origin/main");
  const result = report(repo);
  assert.deepStrictEqual([result.secrets, subjects(result)], [["dummy.pem"], ["work", "dummy.pem"]]);
});

test("preflight reads no file contents: in a blob-less partial clone it fetches no blob", { skip: SKIP }, () => {
  const server = new Repo();
  server.git("config", "uploadpack.allowFilter", "true");
  server.git("switch", "-q", "-c", "feature/x");
  const lines = Array.from({ length: 20 }, (_, index) => `line ${index}\n`).join("");
  server.write("dummy.key", lines);
  server.git("add", "dummy.key");
  server.git("commit", "-q", "-m", "add");
  server.git("rm", "-q", "dummy.key");
  server.write("notes.txt", `${lines}renamed\n`);
  server.git("add", "notes.txt");
  server.git("commit", "-q", "-m", "rename with an edit");
  server.git("switch", "-q", "main");
  const clone = path.join(tmpDir("lah-clone-"), "work");
  server.git("clone", "-q", "--filter=blob:none", "--branch", "feature/x", `file://${server.root}`, clone);
  const missing = () => server.git("-C", clone, "rev-list", "--objects", "--all", "--missing=print").split("\n").filter((line) => line.startsWith("?"));
  const before = missing();
  assert.ok(before.length > 0, "the clone starts without the blobs of older commits");
  const res = run(clone);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(JSON.parse(res.stdout).secrets, ["dummy.key"]);
  assert.deepStrictEqual(missing(), before);
});
