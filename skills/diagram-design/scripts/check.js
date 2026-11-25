#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const USAGE = "usage: check.js <file.html|file.svg>";
const MAX_BYTES = 2 * 1024 * 1024;
const NAMESPACE = "http://www.w3.org/2000/svg";
const ACCENT = "#eb6c36";
const MAX_ACCENT = 2;
const GRID = 4;
const ECHO_LENGTH = 48;
const OPEN_READ = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
const TAG_NAME = /^<(svg|rect|line|path)\b/i;
const TAG_NAME_SPAN = 8;
const ATTRIBUTE = /(?<![\w:-])([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+/g;
const SUPPORTED_COMMANDS = "MLQ";

/** @typedef {{ rule: string, message: string }} Issue */
/** @typedef {Issue & { line: number }} Finding */
/** @typedef {{ accent: number, standalone: boolean }} Context */

class UserError extends Error {}

/** @param {string} file @returns {string} the file content, after refusing anything but a regular file of at most MAX_BYTES */
function readSource(file) {
  let fd;
  try {
    fd = fs.openSync(file, OPEN_READ);
  } catch {
    throw new UserError(`cannot read ${file} (missing, unreadable or a symlink)`);
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new UserError(`${file} is not a regular file`);
    if (stat.size > MAX_BYTES) throw new UserError(`${file} is above ${MAX_BYTES} bytes`);
    return fs.readFileSync(fd, "utf8");
  } finally {
    fs.closeSync(fd);
  }
}

/** @param {string} tag @returns {Map<string, string>} the attributes of one tag */
function attributes(tag) {
  const found = new Map();
  for (const match of tag.matchAll(ATTRIBUTE)) {
    found.set(match[1], match[2] ?? match[3]);
  }
  return found;
}

/** @param {string | undefined} raw @returns {number | undefined} the number, or undefined for a missing value or a percentage */
function numeric(raw) {
  return raw !== undefined && /^-?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : undefined;
}

/** @param {Map<string, string>} attrs @param {Context} context @returns {Issue[]} */
function checkSvg(attrs, context) {
  const namespace = attrs.get("xmlns");
  if (namespace === undefined) {
    return context.standalone ? [{ rule: "xmlns", message: `a standalone svg needs xmlns="${NAMESPACE}"` }] : [];
  }
  return namespace === NAMESPACE ? [] : [{ rule: "xmlns", message: `xmlns must be ${NAMESPACE}, found ${JSON.stringify(namespace.slice(0, ECHO_LENGTH))}` }];
}

/** @param {Map<string, string>} attrs @param {Context} context @returns {Issue[]} */
function checkRect(attrs, context) {
  /** @type {Issue[]} */
  const issues = [];
  for (const name of ["x", "y", "width", "height"]) {
    const value = numeric(attrs.get(name));
    if (value !== undefined && value % GRID !== 0) {
      issues.push({ rule: "grid", message: `rect ${name}="${value}" is not a multiple of ${GRID}` });
    }
  }
  if (attrs.get("stroke")?.toLowerCase() === ACCENT) {
    context.accent += 1;
    if (context.accent > MAX_ACCENT) {
      issues.push({ rule: "accent", message: `accent node ${context.accent}: at most ${MAX_ACCENT} per diagram` });
    }
  }
  return issues;
}

/** @param {Map<string, string>} attrs @returns {Issue[]} */
function checkLine(attrs) {
  const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((name) => numeric(attrs.get(name)));
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return [];
  return x1 !== x2 && y1 !== y2 ? [{ rule: "diagonal", message: `line ${x1},${y1} to ${x2},${y2} is not horizontal or vertical` }] : [];
}

/** @param {Map<string, string>} attrs @returns {Issue[]} */
function checkPath(attrs) {
  const skip = [{ rule: "skip", message: `path uses commands other than ${SUPPORTED_COMMANDS.split("").join(", ")}; not judged` }];
  const tokens = attrs.get("d")?.match(PATH_TOKEN) ?? [];
  /** @type {[number, number] | undefined} */
  let previous;
  let command = "";
  for (let index = 0; index < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[index])) {
      command = tokens[index];
      if (!SUPPORTED_COMMANDS.includes(command)) return skip;
      if (command === "M") previous = undefined;
      index += 1;
      continue;
    }
    const arity = command === "Q" ? 4 : 2;
    const numbers = tokens.slice(index, index + arity).map(Number);
    if (command === "" || numbers.length < arity) return skip;
    for (let at = 0; at < arity; at += 2) {
      /** @type {[number, number]} */
      const point = [numbers[at], numbers[at + 1]];
      if (previous !== undefined && previous[0] !== point[0] && previous[1] !== point[1]) {
        return [{ rule: "diagonal", message: `path segment ${previous.join(",")} to ${point.join(",")} is not horizontal or vertical` }];
      }
      previous = point;
    }
    index += arity;
  }
  return [];
}

const RULES = { svg: checkSvg, rect: checkRect, line: checkLine, path: checkPath };

/** @param {string} text @param {number} from @param {number} to @returns {number} line breaks in text[from, to) */
function breaksBetween(text, from, to) {
  let count = 0;
  for (let at = text.indexOf("\n", from); at !== -1 && at < to; at = text.indexOf("\n", at + 1)) count += 1;
  return count;
}

/**
 * One linear pass: every `indexOf` resumes after the previous tag, so a file of unclosed openers cannot make it quadratic.
 * @param {string} text
 * @returns {Generator<{ name: keyof typeof RULES, index: number, source: string }>} each svg, rect, line and path tag
 */
function* tags(text) {
  let open = text.indexOf("<");
  while (open !== -1) {
    const name = TAG_NAME.exec(text.slice(open, open + TAG_NAME_SPAN));
    if (name === null) {
      open = text.indexOf("<", open + 1);
      continue;
    }
    const close = text.indexOf(">", open);
    if (close === -1) return;
    yield { name: /** @type {keyof typeof RULES} */ (name[1].toLowerCase()), index: open, source: text.slice(open, close + 1) };
    open = text.indexOf("<", close + 1);
  }
}

/** @param {string} text @param {boolean} standalone @returns {Finding[]} every issue, in file order */
function scan(text, standalone) {
  /** @type {Finding[]} */
  const findings = [];
  /** @type {Context} */
  const context = { accent: 0, standalone };
  let line = 1;
  let position = 0;
  for (const tag of tags(text)) {
    line += breaksBetween(text, position, tag.index);
    position = tag.index;
    for (const issue of RULES[tag.name](attributes(tag.source), context)) {
      findings.push({ line, ...issue });
    }
  }
  return findings;
}

/** @param {string[]} args */
function main(args) {
  if (args.length !== 1) throw new UserError(USAGE);
  const [file] = args;
  const findings = scan(readSource(file), file.toLowerCase().endsWith(".svg"));
  for (const finding of findings) {
    process.stdout.write(`${file}:${finding.line} ${finding.rule} ${finding.message}\n`);
  }
  if (findings.some((finding) => finding.rule !== "skip")) {
    process.exitCode = 1;
  } else {
    process.stdout.write("ok\n");
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof UserError)) throw error;
  process.exitCode = 2;
  process.stderr.write(`check: ${error.message}\n`);
}
