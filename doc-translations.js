import { createHash } from "node:crypto";
import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import process from "node:process";

// The checks read Markdown line by line instead of through a Markdown parser: the package has no runtime dependencies,
// consumers import this file from scripts that run before or without their own installs, and the signature only needs
// block-level facts (ATX headings, fences, pipe tables, list items, link targets) that a line scan finds reliably in
// hand-written documentation. docs/decisions.md records what the scan leaves out.

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_DELIMITER = /^\s*\|[\s|:-]*-[\s|:-]*$/;
const LIST_ITEM = /^( *)(?:[-*+]|(\d{1,9})[.)])[ \t]+\S/;
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;
const INLINE_TARGET = /\]\(\s*(<[^>]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/;
const HTML_TARGET = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const HTML_ANCHOR = /\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const STAMP = /^<!-- source-blob: ([0-9a-f]{40}) -->$/;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const USAGE = "usage: doc-translations [--write <document or translation>...]";

function toPosix(path) {
  return path.split(sep).join("/");
}

function readText(root, path) {
  return readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
}

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The Git blob hash of a text file as Git stores it, so a CRLF checkout hashes like the committed LF file. */
function blobHash(text) {
  const bytes = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}

/** The text GitHub renders for a heading: code and escaped characters kept, markup and emphasis removed. */
function renderedText(title) {
  const kept = [];
  const keep = (text) => `\uE000${kept.push(text) - 1}\uE000`;
  return title
    .replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _ticks, body) =>
      keep(/^ .*[^ ].* $/.test(body) ? body.slice(1, -1) : body)
    )
    .replace(/\\([!-/:-@[-`{-~])/g, (_, character) => keep(character))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      if (name[0] !== "#") {
        return ENTITIES[name.toLowerCase()] ?? entity;
      }
      const hex = /^#x/i.test(name);
      const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/\uE000(\d+)\uE000/g, (_, index) => kept[Number(index)]);
}

/** GitHub's heading anchors (github-slugger): a repeated anchor gets the first free `-1`, `-2`, … suffix. */
function headingAnchors() {
  const occurrences = new Map();
  return (title) => {
    const base = renderedText(title)
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
      .replaceAll(" ", "-");
    let anchor = base;
    while (occurrences.has(anchor)) {
      const count = occurrences.get(base) + 1;
      occurrences.set(base, count);
      anchor = `${base}-${count}`;
    }
    occurrences.set(anchor, 0);
    return anchor;
  };
}

/** Blanks code spans out of a run of lines that form one inline context, keeping line breaks and offsets. */
function maskCodeSpans(lines) {
  return lines
    .join("\n")
    .replace(CODE_SPAN, (span) => span.replace(/[^\n]/g, " "))
    .split("\n");
}

function linkTargets(masked) {
  const found = [];
  for (const match of masked.matchAll(INLINE_TARGET)) {
    found.push({ index: match.index, target: match[1] });
  }
  for (const match of masked.matchAll(HTML_TARGET)) {
    found.push({ index: match.index, target: match[1] ?? match[2] });
  }
  const definition = REFERENCE_DEFINITION.exec(masked);
  if (definition) {
    found.push({ index: 0, target: definition[1] });
  }
  return found.toSorted((a, b) => a.index - b.index).map(({ target }) => target.replace(/^<(.*)>$/, "$1"));
}

/** Code blocks and, for every other line, whether it is inside a fence. */
function fences(lines, firstLine) {
  const codeBlocks = [];
  const inFence = [];
  let fence;
  lines.forEach((line, index) => {
    const open = FENCE.exec(line);
    if (fence) {
      inFence.push(true);
      if (open && open[1][0] === fence.marker[0] && open[1].length >= fence.marker.length && open[2].trim() === "") {
        codeBlocks.push(fence.block);
        fence = undefined;
      } else {
        fence.block.lines.push(line);
      }
    } else if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      inFence.push(true);
      fence = { marker: open[1], block: { line: firstLine + index, lines: [open[2].trim()] } };
    } else {
      inFence.push(false);
    }
  });
  if (fence) {
    codeBlocks.push(fence.block);
  }
  return { codeBlocks, inFence };
}

/** Lines with code spans blanked out. A heading, table row or list item starts a new inline context. */
function maskedLines(lines, inFence) {
  const masked = [...lines];
  let start = 0;
  const flush = (end) => {
    if (end <= start) {
      return;
    }
    maskCodeSpans(lines.slice(start, end)).forEach((line, offset) => {
      masked[start + offset] = line;
    });
  };
  lines.forEach((line, index) => {
    const breaks =
      inFence[index] || line.trim() === "" || HEADING.test(line) || TABLE_ROW.test(line) || LIST_ITEM.test(line);
    if (breaks) {
      flush(index);
      start = inFence[index] || line.trim() === "" ? index + 1 : index;
    }
    if (HEADING.test(line) || TABLE_ROW.test(line)) {
      flush(index + 1);
      start = index + 1;
    }
  });
  flush(lines.length);
  return masked;
}

/** Block structure and link targets of a Markdown text, each with its 1-based line number. */
function signature(text, firstLine = 1) {
  const lines = text.split("\n");
  const { codeBlocks, inFence } = fences(lines, firstLine);
  const masked = maskedLines(lines, inFence);
  const result = { headings: [], codeBlocks, tables: [], listItems: [], links: [], anchors: new Set() };
  const anchorOf = headingAnchors();
  let table;
  let previousBlank = true;
  let previousText = false;
  let inList = false;
  lines.forEach((line, index) => {
    const number = firstLine + index;
    if (inFence[index] || line.trim() === "") {
      table = undefined;
      previousBlank = !inFence[index];
      previousText = false;
      return;
    }
    if (TABLE_ROW.test(line)) {
      if (table) {
        table.rows++;
        if (table.rows === 2 && TABLE_DELIMITER.test(line)) {
          table.columns = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
          result.tables.push(table);
        }
      } else {
        table = { line: number, rows: 1, columns: 0 };
      }
    } else {
      table = undefined;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const title = (heading[2] ?? "").trim().replace(/(?:^|[ \t]+)#+$/, "");
      result.anchors.add(anchorOf(title));
      result.headings.push({ line: number, level: heading[1].length, title });
      inList = false;
    }
    // An ordered list that does not start at 1 cannot interrupt a paragraph, so a wrapped paragraph line starting with
    // "2." is text, while the same line inside a list or after another block starts an item.
    const item = table || heading ? undefined : LIST_ITEM.exec(line);
    if (item && (item[2] === undefined || Number(item[2]) === 1 || !previousText || inList)) {
      result.listItems.push({ line: number, indent: item[1].length, ordered: item[2] !== undefined });
      inList = true;
    } else if (previousBlank && !/^\s/.test(line)) {
      inList = false;
    }
    for (const match of masked[index].matchAll(HTML_ANCHOR)) {
      result.anchors.add(match[1] ?? match[2]);
    }
    for (const target of linkTargets(masked[index])) {
      result.links.push({ line: number, target });
    }
    previousBlank = false;
    previousText = !heading && !table;
  });
  return result;
}

/** Splits a link target into an external URL or a repository path resolved from `from`, plus its fragment. */
function resolveTarget(from, target) {
  if (EXTERNAL.test(target)) {
    return { external: target };
  }
  const hash = target.indexOf("#");
  const path = decode((hash === -1 ? target : target.slice(0, hash)).split("?")[0]);
  const fragment = hash === -1 ? undefined : target.slice(hash + 1);
  if (path === "") {
    return { path: from, fragment };
  }
  // GitHub resolves a link starting with `/` from the repository root.
  const resolved = path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(from), path);
  return { path: posix.normalize(resolved), fragment };
}

function discover(options) {
  const root = resolve(options.root ?? process.cwd());
  const files = (patterns = []) =>
    new Set(
      globSync(patterns, { cwd: root, withFileTypes: true, exclude: (entry) => entry.name === "node_modules" })
        .filter((entry) => entry.isFile())
        .map((entry) => toPosix(relative(root, resolve(root, entry.parentPath, entry.name))))
    );
  const translated = files(options.translations);
  const excluded = files(options.exclude);
  const sources = [...files(options.sources)].filter((path) => !translated.has(path) && !excluded.has(path)).toSorted();
  const problems = [];
  const pairs = new Map();
  const sourceOf = new Map();
  for (const source of sources) {
    const translation = options.translationOf(source);
    if (translation === source) {
      problems.push(`${source}: translationOf returns the document itself`);
    } else if (sourceOf.has(translation)) {
      problems.push(`${translation}: translation of both ${sourceOf.get(translation)} and ${source}`);
    } else {
      if (!options.translations.some((pattern) => posix.matchesGlob(translation, pattern))) {
        problems.push(`${translation}: translation of ${source} is outside the translations patterns`);
      }
      pairs.set(source, translation);
      sourceOf.set(translation, source);
    }
  }
  const orphans = [...translated].filter((path) => !sourceOf.has(path)).toSorted();
  problems.unshift(...orphans.map((path) => `${path}: no source document in scope`));
  return { root, pairs, sourceOf, problems, anchors: new Map() };
}

/**
 * Splits the translation's header and stamp lines from its body. `stamp` is the recorded hash, or undefined when the
 * stamp line is missing; `stampIndex` is where a stamp line is or would be inserted.
 */
function translationParts(text, header) {
  const lines = text.split("\n");
  let index = Math.max(
    lines.findIndex((line) => line.trim() !== ""),
    0
  );
  const headerMatches = header === undefined || lines[index] === header;
  if (header !== undefined && headerMatches) {
    index++;
  }
  let next = index;
  while (next < lines.length && lines[next].trim() === "") {
    next++;
  }
  const stamp = STAMP.exec(lines[next] ?? "")?.[1];
  const bodyStart = stamp ? next + 1 : index;
  return { lines, headerMatches, stamp, stampIndex: index, stampLine: next, bodyStart };
}

function compareSequence(name, items, key, describe) {
  const [source, translation] = items;
  const length = Math.max(source.list.length, translation.list.length);
  for (let i = 0; i < length; i++) {
    const a = source.list[i];
    const b = translation.list[i];
    if (a === undefined || b === undefined) {
      return `${source.list.length} ${name} in ${source.path}, ${translation.list.length} here (first unmatched: ${
        a ? `${source.path}:${a.line}` : `line ${b.line}`
      })`;
    }
    if (key(a, "source") !== key(b, "translation")) {
      return `${name} ${i + 1} differs: ${describe(a, b)}`;
    }
  }
  return undefined;
}

function shorten(text) {
  return text === undefined ? "(end of block)" : JSON.stringify(text.length > 80 ? `${text.slice(0, 77)}...` : text);
}

function checkPair(context, source, translation) {
  const { root, sourceOf, pairs } = context;
  const problems = [];
  const add = (problem) => problems.push(`${translation}: ${problem}`);
  if (!existsSync(join(root, translation))) {
    return { problems: [`${source}: missing translation ${translation}`] };
  }
  const sourceText = readText(root, source);
  const header = context.header?.(source);
  const parts = translationParts(readText(root, translation), header);
  if (!parts.headerMatches) {
    add(`first line must be: ${header}`);
  }
  const a = signature(sourceText);
  const b = signature(parts.lines.slice(parts.bodyStart).join("\n"), parts.bodyStart + 1);
  const sides = (key) => [
    { path: source, list: a[key] },
    { path: translation, list: b[key] }
  ];
  const at = (x, y, text) => `${source}:${x.line} ${text(x)}, line ${y.line} ${text(y)}`;

  const headings = compareSequence(
    "headings",
    sides("headings"),
    (h) => h.level,
    (x, y) => at(x, y, (h) => `level ${h.level} "${h.title}"`)
  );
  const code = compareSequence(
    "code blocks",
    sides("codeBlocks"),
    (c) => c.lines.join("\n"),
    (x, y) => {
      const offset = x.lines.findIndex((line, i) => line !== y.lines[i]);
      const k = offset === -1 ? x.lines.length : offset;
      const what = k === 0 ? "info string" : "line";
      return `${source}:${x.line + k} ${what} ${shorten(x.lines[k])}, line ${y.line + k} ${shorten(y.lines[k])} (code is copied unchanged)`;
    }
  );
  const tables = compareSequence(
    "tables",
    sides("tables"),
    (t) => `${t.rows}x${t.columns}`,
    (x, y) => at(x, y, (t) => `${t.rows} rows x ${t.columns} columns`)
  );
  const lists = compareSequence(
    "list items",
    sides("listItems"),
    (l) => `${l.indent}:${l.ordered}`,
    (x, y) => at(x, y, (l) => `${l.ordered ? "ordered" : "bullet"} at indent ${l.indent}`)
  );
  // A link from the source to a document with a translation points to that translation, and a link to a translation
  // points back to its source; every other target stays as it is. A link to either file of this pair, such as a
  // same-page fragment or a language switcher, may point to either, because switchers are written both as "the other
  // language" and as a self link next to the other language.
  const linkKey = (link, side) => {
    const resolved = resolveTarget(side === "source" ? source : translation, link.target);
    if (resolved.external !== undefined) {
      return resolved.external;
    }
    const mapped =
      side === "source" ? (pairs.get(resolved.path) ?? sourceOf.get(resolved.path) ?? resolved.path) : resolved.path;
    const path = mapped === source || mapped === translation ? "this document" : mapped;
    return `${path}${resolved.fragment === undefined ? "" : "#…"}`;
  };
  const links = compareSequence(
    "links",
    sides("links"),
    linkKey,
    (x, y) =>
      `${source}:${x.line} ${x.target} (expected here: ${linkKey(x, "source")}), line ${y.line} ${y.target} (resolves to: ${linkKey(y, "translation")})`
  );
  [headings, code, tables, lists, links].filter((problem) => problem !== undefined).forEach(add);

  for (const link of b.links) {
    const resolved = resolveTarget(translation, link.target);
    if (resolved.fragment === undefined || resolved.fragment === "" || !resolved.path.endsWith(".md")) {
      continue;
    }
    if (!existsSync(join(root, resolved.path))) {
      add(`line ${link.line}: link target ${link.target} does not exist`);
      continue;
    }
    if (!context.anchors.has(resolved.path)) {
      context.anchors.set(resolved.path, signature(readText(root, resolved.path)).anchors);
    }
    const anchors = resolved.path === translation ? b.anchors : context.anchors.get(resolved.path);
    const fragment = decode(resolved.fragment);
    if (!anchors.has(fragment)) {
      add(`line ${link.line}: no heading or id "${fragment}" in ${resolved.path}`);
    }
  }

  const current = blobHash(sourceText);
  if (context.stamp && parts.headerMatches) {
    if (parts.stamp === undefined) {
      add(
        `no "<!-- source-blob: … -->" line after the header; once it matches ${source}, run with --write ${translation}`
      );
    } else if (parts.stamp !== current) {
      add(
        `${source} changed since this translation was recorded (git show ${parts.stamp.slice(0, 12)} prints the recorded text); update the translation, then run with --write ${translation}`
      );
    }
  }
  return { problems, parts, current };
}

function checkDocTranslations(options) {
  const context = { ...options, ...discover(options) };
  const problems = [...context.problems];
  for (const [source, translation] of context.pairs) {
    problems.push(...checkPair(context, source, translation).problems);
  }
  return { pairs: context.pairs.size, problems };
}

/** Writes the source's current blob hash into each named pair whose translation passes every other check. */
function recordDocTranslations(options, files) {
  const context = { ...options, ...discover(options) };
  const recorded = [];
  const problems = [];
  for (const file of files) {
    const path = toPosix(relative(context.root, isAbsolute(file) ? file : resolve(file)));
    const source = context.pairs.has(path) ? path : context.sourceOf.get(path);
    if (source === undefined) {
      problems.push(`${file}: ${path} is not a document or translation in scope under ${context.root}`);
      continue;
    }
    const translation = context.pairs.get(source);
    const result = checkPair({ ...context, stamp: false }, source, translation);
    if (result.problems.length > 0) {
      problems.push(...result.problems);
      continue;
    }
    const { lines, stamp, stampIndex, stampLine } = result.parts;
    const line = `<!-- source-blob: ${result.current} -->`;
    if (stamp === undefined) {
      lines.splice(stampIndex, 0, ...(stampIndex === 0 ? [line, ""] : ["", line]));
    } else {
      lines[stampLine] = line;
    }
    writeFileSync(join(context.root, translation), lines.join("\n"));
    recorded.push(translation);
  }
  return { recorded, problems };
}

function report(problems) {
  console.error("doc-translations: failed");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
}

function runDocTranslations(options, argv = process.argv.slice(2)) {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    console.log(USAGE);
    return 0;
  }
  if (argv.length > 0 && (argv[0] !== "--write" || argv.length === 1)) {
    console.error(USAGE);
    return 2;
  }
  if (argv[0] === "--write") {
    if (!options.stamp) {
      console.error(
        "doc-translations: --write records source hashes, which this repository does not use (stamp is off)"
      );
      return 2;
    }
    const { recorded, problems } = recordDocTranslations(options, argv.slice(1));
    for (const path of recorded) {
      console.log(`doc-translations: recorded ${path}`);
    }
    if (problems.length > 0) {
      report(problems);
      return 1;
    }
  }
  const { pairs, problems } = checkDocTranslations(options);
  if (problems.length > 0) {
    report(problems);
    return 1;
  }
  console.log(`doc-translations: ok (${pairs} pair${pairs === 1 ? "" : "s"})`);
  return 0;
}

export { checkDocTranslations, runDocTranslations };
