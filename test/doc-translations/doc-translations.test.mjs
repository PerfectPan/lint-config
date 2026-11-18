import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { checkDocTranslations, runDocTranslations } from "../../doc-translations.js";

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), "doc-translations-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const banner = (path) => `> 中文阅读版。以英文原文 ${path} 为准。`;

function sibling(root, extra = {}) {
  return {
    root,
    sources: ["README.md", "docs/*.md"],
    translations: ["README.zh-CN.md", "docs/*.zh-CN.md"],
    translationOf: (path) => path.replace(/\.md$/, ".zh-CN.md"),
    header: banner,
    ...extra
  };
}

const guide = `# Guide

See [usage](#usage) and the [reference](reference.md#options), or [contribute](../CONTRIBUTING.md).

## Usage

1. Install it.
2. Run it.

\`\`\`sh
npx tool --flag
\`\`\`

| Flag | Meaning |
| --- | --- |
| \`--flag\` | Does it |

## Usage

- ![logo](../logo.svg) [site](https://example.com/a(b))
`;

const guideZh = `${banner("docs/guide.md")}

# 指南

参见[用法](#用法)和[参考](reference.zh-CN.md#选项)，或[参与贡献](../CONTRIBUTING.md)。

## 用法

1. 安装。
2. 运行。

\`\`\`sh
npx tool --flag
\`\`\`

| 参数 | 含义 |
| --- | --- |
| \`--flag\` | 执行 |

## 用法

- ![logo](../logo.svg) [站点](https://example.com/a(b))
`;

const reference = "# Reference\n\n## Options\n\nBack to the [guide](guide.md#usage-1).\n";
const referenceZh = `${banner("docs/reference.md")}\n\n# 参考\n\n## 选项\n\n返回[指南](guide.zh-CN.md#用法-1)。\n`;

function cleanRepo(overrides = {}) {
  return repo({
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/guide.md": guide,
    "docs/guide.zh-CN.md": guideZh,
    "docs/reference.md": reference,
    "docs/reference.zh-CN.md": referenceZh,
    ...overrides
  });
}

/** A repository with one extra pair, `docs/x.md`, written from its body lines; both sides get the same body. */
function pairRepo(source, translation, extra = {}) {
  return cleanRepo({
    "docs/x.md": source,
    "docs/x.zh-CN.md": `${banner("docs/x.md")}\n\n${translation}`,
    ...extra
  });
}

function problems(options) {
  return checkDocTranslations(options).problems;
}

describe("checkDocTranslations, sibling layout", () => {
  it("passes faithful pairs and counts them", () => {
    const result = checkDocTranslations(sibling(cleanRepo()));
    assert.deepEqual(result, { pairs: 2, problems: [] });
  });

  it("reports a missing translation and a translation without a source", () => {
    const root = cleanRepo({ "docs/orphan.zh-CN.md": "x\n" });
    rmSync(join(root, "docs/reference.zh-CN.md"));
    assert.deepEqual(problems(sibling(root)), [
      "docs/orphan.zh-CN.md: no source document in scope",
      "docs/guide.zh-CN.md: line 5: link target reference.zh-CN.md#选项 does not exist",
      "docs/reference.md: missing translation docs/reference.zh-CN.md"
    ]);
  });

  it("leaves excluded documents out, and rejects a translation of one", () => {
    const root = cleanRepo({ "docs/template.md": "# T\n" });
    assert.deepEqual(problems(sibling(root, { exclude: ["docs/template.md"] })), []);
    writeFileSync(join(root, "docs/template.zh-CN.md"), "# T\n");
    assert.deepEqual(problems(sibling(root, { exclude: ["docs/template.md"] })), [
      "docs/template.zh-CN.md: no source document in scope"
    ]);
  });

  it("never searches node_modules", () => {
    const root = cleanRepo({ "docs/node_modules/pkg/readme.md": "# Package\n" });
    assert.deepEqual(problems(sibling(root, { sources: ["docs/**/*.md"], translations: ["docs/**/*.zh-CN.md"] })), []);
  });

  it("rejects a translationOf that maps a document to itself, to a taken path, or outside translations", () => {
    const root = repo({
      "README.md": "# Tool\n",
      "docs/a.md": "# A\n",
      "docs/b.md": "# B\n",
      "docs/a.zh-CN.md": `${banner("docs/a.md")}\n\n# 甲\n`
    });
    const options = sibling(root, { translationOf: (path) => (path === "README.md" ? path : "docs/a.zh-CN.md") });
    assert.deepEqual(problems(options), [
      "README.md: translationOf returns the document itself",
      "docs/a.zh-CN.md: translation of both docs/a.md and docs/b.md"
    ]);
    assert.deepEqual(problems(sibling(root, { translations: ["docs/*.zh-CN.md"] })), [
      "README.zh-CN.md: translation of README.md is outside the translations patterns",
      "README.md: missing translation README.zh-CN.md",
      "docs/b.md: missing translation docs/b.zh-CN.md"
    ]);
  });

  it("requires the header line, and reports only that when the header is wrong", () => {
    const root = cleanRepo({ "docs/reference.zh-CN.md": referenceZh.replace("中文阅读版", "中文版") });
    const expected = [`docs/reference.zh-CN.md: first line must be: ${banner("docs/reference.md")}`];
    assert.deepEqual(problems(sibling(root)), expected);
    assert.deepEqual(
      problems(sibling(root, { stamp: true })).filter((p) => p.startsWith("docs/reference")),
      expected
    );
  });

  it("compares heading levels in order", () => {
    const root = cleanRepo({ "docs/reference.zh-CN.md": referenceZh.replace("## 选项", "### 选项") });
    assert.deepEqual(problems(sibling(root)), [
      'docs/reference.zh-CN.md: headings 2 differs: docs/reference.md:3 level 2 "Options", line 5 level 3 "选项"'
    ]);
  });

  it("requires code blocks to be copied unchanged and names the first differing line", () => {
    const root = cleanRepo({ "docs/guide.zh-CN.md": guideZh.replace("npx tool --flag", "npx tool --标志") });
    assert.deepEqual(problems(sibling(root)), [
      'docs/guide.zh-CN.md: code blocks 1 differs: docs/guide.md:11 line "npx tool --flag", line 13 "npx tool --标志" (code is copied unchanged)'
    ]);
  });

  it("compares a code block's language but not the meta after it, such as a translated title", () => {
    const source = '```ts title="Load a session"\nload();\n```\n';
    assert.deepEqual(problems(sibling(pairRepo(source, source.replace("Load a session", "加载会话")))), []);
    assert.deepEqual(problems(sibling(pairRepo(source, source.replace("```ts", "```js")))), [
      'docs/x.zh-CN.md: code blocks 1 differs: docs/x.md:1 language "ts", line 3 "js" (code is copied unchanged)'
    ]);
  });

  it("finds fences nested deep in a list, and keeps their indentation", () => {
    const source = "- a\n  - b\n\n        ```sh\n        echo 1\n        ```\n";
    const changed = pairRepo(source, source.replace("echo 1", "echo 2"));
    assert.match(problems(sibling(changed))[0], /code blocks 1 differs: docs\/x\.md:5 line "        echo 1"/);
    const reindented = pairRepo(source, source.replace("        echo 1", "      echo 1"));
    assert.match(problems(sibling(reindented))[0], /code blocks 1 differs/);
  });

  it("compares table rows and columns", () => {
    const root = cleanRepo({
      "docs/guide.zh-CN.md": guideZh.replace("| `--flag` | 执行 |", "| `--flag` | 执行 |\n| 多 | 一行 |")
    });
    assert.deepEqual(problems(sibling(root)), [
      "docs/guide.zh-CN.md: tables 1 differs: docs/guide.md:14 3 rows x 2 columns, line 16 4 rows x 2 columns"
    ]);
  });

  it("compares list items by kind and indent", () => {
    const root = cleanRepo({ "docs/guide.zh-CN.md": guideZh.replace("2. 运行。", "2. 运行。\n3. 完成。") });
    assert.deepEqual(problems(sibling(root)), [
      "docs/guide.zh-CN.md: list items 3 differs: docs/guide.md:20 bullet at indent 0, line 11 ordered at indent 0"
    ]);
    const removed = cleanRepo({ "docs/guide.zh-CN.md": guideZh.replace("- ![logo]", "![logo]") });
    assert.deepEqual(problems(sibling(removed)), [
      "docs/guide.zh-CN.md: 3 list items in docs/guide.md, 2 here (first unmatched: docs/guide.md:20)"
    ]);
    const nested = pairRepo("- a\n  - b\n", "- 甲\n- 乙\n");
    assert.deepEqual(problems(sibling(nested)), [
      "docs/x.zh-CN.md: list items 2 differs: docs/x.md:2 bullet at indent 2, line 4 bullet at indent 0"
    ]);
  });

  it("reads a wrapped paragraph line starting with 2. as text, but not after another block", () => {
    const wrapped = pairRepo("Count to\n2. Then stop.\n", "数到 2。然后停止。\n");
    assert.deepEqual(problems(sibling(wrapped)), []);
    const afterFence = pairRepo("```\nx\n```\n2. Two.\n", "```\nx\n```\n二。\n");
    assert.match(problems(sibling(afterFence))[0], /1 list items in docs\/x\.md, 0 here/);
  });

  it("requires a link to a translated document to point to its translation", () => {
    const root = cleanRepo({
      "docs/reference.zh-CN.md": referenceZh.replace("guide.zh-CN.md#用法-1", "guide.md#usage-1")
    });
    assert.deepEqual(problems(sibling(root)), [
      "docs/reference.zh-CN.md: links 1 differs: docs/reference.md:5 guide.md#usage-1 (expected here: docs/guide.zh-CN.md#…), line 7 guide.md#usage-1 (resolves to: docs/guide.md#…)"
    ]);
  });

  it("keeps links to untranslated files and external URLs as they are", () => {
    const local = cleanRepo({
      "docs/guide.zh-CN.md": guideZh.replace("../CONTRIBUTING.md", "../CONTRIBUTING.zh-CN.md")
    });
    assert.match(
      problems(sibling(local))[0],
      /links 3 differs: .*\.\.\/CONTRIBUTING\.md \(expected here: CONTRIBUTING\.md\)/
    );
    const external = cleanRepo({
      "docs/guide.zh-CN.md": guideZh.replace("https://example.com/a(b)", "https://example.com/zh")
    });
    assert.match(
      problems(sibling(external))[0],
      /links 5 differs: .*https:\/\/example\.com\/a\(b\) \(expected here: https:\/\/example\.com\/a\(b\)\)/
    );
  });

  it("maps a link to another document's translation back to that document", () => {
    const root = pairRepo("Read the [Chinese guide](guide.zh-CN.md).\n", "阅读[英文指南](guide.md)。\n");
    assert.deepEqual(problems(sibling(root)), []);
    const kept = pairRepo("Read the [Chinese guide](guide.zh-CN.md).\n", "阅读[中文指南](guide.zh-CN.md)。\n");
    assert.match(problems(sibling(kept))[0], /expected here: docs\/guide\.md\)/);
  });

  it("reads link targets from href and src attributes and reference definitions, but not footnotes", () => {
    const html = pairRepo(
      '<a href="guide.md">Guide</a> <img src="../logo.svg">\n',
      '<a href="guide.md">指南</a> <img src="../logo.svg">\n'
    );
    assert.match(
      problems(sibling(html))[0],
      /links 1 differs: docs\/x\.md:1 guide\.md \(expected here: docs\/guide\.zh-CN\.md\)/
    );
    const definition = pairRepo("See [the guide][g].\n\n[g]: guide.md\n", "参见[指南][g]。\n\n[g]: guide.md\n");
    assert.match(problems(sibling(definition))[0], /links 1 differs: docs\/x\.md:3 guide\.md/);
    const footnote = pairRepo("Note.[^1]\n\n[^1]: See the guide.\n", "注意。[^1]\n\n[^1]: 参见指南。\n");
    assert.deepEqual(problems(sibling(footnote)), []);
  });

  it("ignores links inside code spans, including spans that wrap across lines", () => {
    const span = pairRepo("Type `[x](guide.md#nowhere)` literally.\n", "按原样输入 `[x](guide.md#nowhere)`。\n");
    assert.deepEqual(problems(sibling(span)), []);
    const wrapped = pairRepo("Type `[x](guide.md\nliterally` here.\n", "输入 `[x](guide.md literally`。\n");
    assert.deepEqual(problems(sibling(wrapped)), []);
  });

  it("resolves root-relative and percent-encoded links", () => {
    const rooted = pairRepo(
      "See [options](/docs/reference.md#options).\n",
      "参见[选项](/docs/reference.zh-CN.md#选项)。\n"
    );
    assert.deepEqual(problems(sibling(rooted)), []);
    const encoded = pairRepo(
      "See [the space doc](a%20b.md) and [usage](guide.md#usage).\n",
      "参见[空格文档](a%20b.zh-CN.md)和[用法](guide.zh-CN.md#%E7%94%A8%E6%B3%95)。\n",
      { "docs/a b.md": "# A\n", "docs/a b.zh-CN.md": `${banner("docs/a b.md")}\n\n# 甲\n` }
    );
    assert.deepEqual(problems(sibling(encoded)), []);
  });

  it("requires every fragment in a translation to name a heading or id of its target", () => {
    const root = cleanRepo({ "docs/reference.zh-CN.md": referenceZh.replace("#用法-1", "#用法-2") });
    assert.deepEqual(problems(sibling(root)), [
      'docs/reference.zh-CN.md: line 7: no heading or id "用法-2" in docs/guide.zh-CN.md'
    ]);
    const ids = pairRepo(
      '<a id="custom"></a>\n\nSee [here](#custom) and [there](reference.md#options).\n',
      '<a id="custom"></a>\n\n参见[此处](#custom)与[彼处](reference.zh-CN.md#选项)。\n'
    );
    assert.deepEqual(problems(sibling(ids)), []);
    const codeId = pairRepo('Write `id="fake"`, then see [it](#fake).\n', '写 `id="fake"`，再看[它](#fake)。\n');
    assert.deepEqual(problems(sibling(codeId)), [
      'docs/x.zh-CN.md: line 3: no heading or id "fake" in docs/x.zh-CN.md'
    ]);
  });

  it("builds anchors the way GitHub does", () => {
    const headings = [
      ["## Step 1: install (npm)", "## 第 1 步：安装（npm）", "#第-1-步安装npm"],
      ["## A", "## 甲", "#甲"],
      ["## A", "## 甲", "#甲-1"],
      ["## A-1", "## 甲-1", "#甲-1-1"],
      ["## _Lazy_ `__init__` & more", "## _懒_ `__init__` &amp; 更多", "#懒-__init__--更多"],
      ["## Read `x.md`, then [run](y.md)", "## 阅读 `x.md`，然后[运行](y.zh-CN.md)", "#阅读-xmd然后运行"]
    ];
    const source = headings.map(([en]) => en).join("\n\n");
    const links = headings.map((_, i) => `[l${i}](#)`).join(" ");
    const translation = headings.map(([, zh]) => zh).join("\n\n");
    const zhLinks = headings.map(([, , anchor], i) => `[l${i}](${anchor})`).join(" ");
    const root = pairRepo(`${source}\n\n${links}\n`, `${translation}\n\n${zhLinks}\n`, {
      "docs/y.md": "# Y\n",
      "docs/y.zh-CN.md": `${banner("docs/y.md")}\n\n# 乙\n`
    });
    assert.deepEqual(problems(sibling(root)), []);
  });

  it("maps a language switcher to the other side", () => {
    const root = repo({
      "README.md": '<a href="README.zh-CN.md">中文</a>\n\n# Tool\n',
      "README.zh-CN.md": `${banner("README.md")}\n\n<a href="README.md">English</a>\n\n# 工具\n`
    });
    assert.deepEqual(problems(sibling(root)), []);
  });
});

describe("checkDocTranslations, directory per language", () => {
  const options = (root) => ({
    root,
    sources: ["docs/en/**/*.md"],
    translations: ["docs/zh-CN/**/*.md"],
    translationOf: (path) => path.replace(/^docs\/en\//, "docs/zh-CN/")
  });

  it("pairs mirrored trees without a header, with self-link switchers", () => {
    const root = repo({
      "docs/en/index.md":
        "[English](index.md) | [简体中文](../zh-CN/index.md)\n\n# Docs\n\nRead [the API](api/index.md).\n",
      "docs/en/api/index.md": "# API\n",
      "docs/zh-CN/index.md":
        "[English](../en/index.md) | [简体中文](index.md)\n\n# 文档\n\n阅读 [API](api/index.md)。\n",
      "docs/zh-CN/api/index.md": "# API\n"
    });
    assert.deepEqual(checkDocTranslations(options(root)), { pairs: 2, problems: [] });
  });

  it("leaves frontmatter out of the comparison and of the anchors a fragment may name", () => {
    const root = repo({
      "docs/en/a.md": "---\ntitle: A\n# a YAML comment\nsee: [b](b.md)\n---\n\n# A\n\n[B](b.md#hidden)\n",
      "docs/zh-CN/a.md": "---\ntitle: 甲\n# 注释\ntags:\n  - x\n---\n\n# 甲\n\n[乙](b.md#hidden)\n",
      "docs/en/b.md": "---\n# hidden\n---\n\n# B\n",
      "docs/zh-CN/b.md": "---\n# hidden\n---\n\n# 乙\n"
    });
    assert.deepEqual(problems(options(root)), [
      'docs/zh-CN/a.md: line 10: no heading or id "hidden" in docs/zh-CN/b.md'
    ]);
  });

  it("numbers lines from the top of each file when both have frontmatter of different lengths", () => {
    const root = repo({
      "docs/en/a.md": "---\ntitle: A\n---\n\n# A\n\n## Usage\n",
      "docs/zh-CN/a.md": "---\ntitle: 甲\nsummary: 乙\n---\n\n# 甲\n\n### 用法\n"
    });
    assert.deepEqual(problems(options(root)), [
      'docs/zh-CN/a.md: headings 2 differs: docs/en/a.md:7 level 2 "Usage", line 8 level 3 "用法"'
    ]);
  });

  it("reports the unmatched side of a mirrored tree", () => {
    const root = repo({ "docs/en/a.md": "# A\n", "docs/zh-CN/b.md": "# B\n" });
    assert.deepEqual(problems(options(root)), [
      "docs/zh-CN/b.md: no source document in scope",
      "docs/en/a.md: missing translation docs/zh-CN/a.md"
    ]);
  });
});

describe("runDocTranslations", () => {
  const quiet = (run) => {
    const { log, error } = console;
    const lines = [];
    console.log = (line) => lines.push(line);
    console.error = (line) => lines.push(line);
    try {
      return { code: run(), lines };
    } finally {
      Object.assign(console, { log, error });
    }
  };

  it("records the source blob hash, then fails when the source changes", () => {
    const root = cleanRepo();
    const options = sibling(root, { stamp: true });
    const first = quiet(() => runDocTranslations(options, []));
    assert.equal(first.code, 1);
    assert.match(first.lines.join("\n"), /docs\/guide\.zh-CN\.md: no "<!-- source-blob: … -->" line after the header/);

    const write = quiet(() =>
      runDocTranslations(options, ["--write", join(root, "docs/guide.md"), join(root, "docs/reference.zh-CN.md")])
    );
    assert.deepEqual(write, {
      code: 0,
      lines: [
        "doc-translations: recorded docs/guide.zh-CN.md",
        "doc-translations: recorded docs/reference.zh-CN.md",
        "doc-translations: ok (2 pairs)"
      ]
    });
    const recorded = readFileSync(join(root, "docs/reference.zh-CN.md"), "utf8").split("\n");
    // `git hash-object docs/reference.md` prints this hash for the reference fixture.
    assert.deepEqual(recorded.slice(0, 4), [
      banner("docs/reference.md"),
      "",
      "<!-- source-blob: 9050a5c8daf53ee4765fb4bcf830e32c131428d7 -->",
      ""
    ]);

    writeFileSync(join(root, "docs/reference.md"), reference.replace("Back to", "Return to"));
    const stale = quiet(() => runDocTranslations(options, []));
    assert.equal(stale.code, 1);
    assert.match(
      stale.lines.join("\n"),
      /docs\/reference\.md changed since this translation was recorded \(git show 9050a5c8daf5 prints/
    );

    const rewrite = quiet(() => runDocTranslations(options, ["--write", join(root, "docs/reference.md")]));
    assert.equal(rewrite.code, 0);
    assert.equal(
      readFileSync(join(root, "docs/reference.zh-CN.md"), "utf8")
        .split("\n")
        .filter((line) => line.startsWith("<!--")).length,
      1
    );
  });

  it("puts the stamp first when there is no header", () => {
    const root = repo({ "docs/en/a.md": "# A\n", "docs/zh-CN/a.md": "# 甲\n" });
    const options = {
      root,
      sources: ["docs/en/*.md"],
      translations: ["docs/zh-CN/*.md"],
      translationOf: (path) => path.replace("/en/", "/zh-CN/"),
      stamp: true
    };
    assert.equal(quiet(() => runDocTranslations(options, ["--write", join(root, "docs/en/a.md")])).code, 0);
    assert.match(readFileSync(join(root, "docs/zh-CN/a.md"), "utf8"), /^<!-- source-blob: [0-9a-f]{40} -->\n\n# 甲\n$/);
  });

  it("keeps the stamp in the frontmatter of a site page, and the header after the frontmatter", () => {
    const page = "---\ntitle: A\n---\n\n# A\n";
    const pageZh = "---\ntitle: 甲\n---\n\n> 译文\n\n# 甲\n";
    const root = repo({ "site/en/a.mdx": page, "site/zh/a.mdx": pageZh });
    const options = {
      root,
      sources: ["site/en/*.mdx"],
      translations: ["site/zh/*.mdx"],
      translationOf: (path) => path.replace("/en/", "/zh/"),
      header: () => "> 译文",
      stamp: true
    };
    const missing = quiet(() => runDocTranslations(options, []));
    assert.equal(missing.code, 1);
    assert.match(missing.lines.join("\n"), /site\/zh\/a\.mdx: no "source-blob: …" key in the frontmatter/);

    assert.equal(quiet(() => runDocTranslations(options, ["--write", join(root, "site/en/a.mdx")])).code, 0);
    // `git hash-object` prints this hash for `page`.
    const recorded = pageZh.replace(
      "title: 甲\n",
      "title: 甲\nsource-blob: d3f971e483068ccb3d75e483d41de1c9941efdef\n"
    );
    assert.equal(readFileSync(join(root, "site/zh/a.mdx"), "utf8"), recorded);

    writeFileSync(join(root, "site/en/a.mdx"), `${page}\nMore.\n`);
    assert.match(
      quiet(() => runDocTranslations(options, [])).lines.join("\n"),
      /site\/en\/a\.mdx changed since this translation was recorded/
    );
    assert.equal(quiet(() => runDocTranslations(options, ["--write", join(root, "site/zh/a.mdx")])).code, 0);
    assert.equal(readFileSync(join(root, "site/zh/a.mdx"), "utf8").match(/source-blob/g).length, 1);

    // A key written by hand in another form is reported and replaced, never kept beside a second key.
    const hash = "0".repeat(40);
    const handWritten = [
      'source-blob: "d3f971e4"',
      `source-blob :  ${hash}`,
      `"source-blob": ${hash}`,
      `source-blob: >-\n  ${hash}`,
      `source-blob: ${hash}\nsource-blob: ${hash}`
    ];
    for (const written of handWritten) {
      writeFileSync(join(root, "site/zh/a.mdx"), pageZh.replace("title: 甲\n", `${written}\ntitle: 甲\n`));
      assert.deepEqual(
        problems(options),
        [
          'site/zh/a.mdx: "source-blob" in the frontmatter must be one line "source-blob: <Git blob hash in lowercase hex>"; once it matches site/en/a.mdx, run with --write site/zh/a.mdx'
        ],
        written
      );
      assert.equal(quiet(() => runDocTranslations(options, ["--write", join(root, "site/zh/a.mdx")])).code, 0, written);
      assert.match(
        readFileSync(join(root, "site/zh/a.mdx"), "utf8"),
        /^---\nsource-blob: [0-9a-f]{40}\ntitle: 甲\n---\n/,
        written
      );
    }

    writeFileSync(join(root, "site/zh/a.mdx"), pageZh.replace("> 译文", "> 中文"));
    assert.deepEqual(problems(options), ["site/zh/a.mdx: first line after the frontmatter must be: > 译文"]);
  });

  it("hashes a CRLF checkout like the LF file Git stores", () => {
    const root = cleanRepo();
    const options = sibling(root, { stamp: true });
    quiet(() => runDocTranslations(options, ["--write", join(root, "docs/reference.md"), join(root, "docs/guide.md")]));
    writeFileSync(join(root, "docs/reference.md"), reference.replaceAll("\n", "\r\n"));
    assert.equal(quiet(() => runDocTranslations(options, [])).code, 0);
  });

  it("refuses to record a translation that fails another check", () => {
    const root = cleanRepo({ "docs/reference.zh-CN.md": referenceZh.replace("## 选项", "### 选项") });
    const result = quiet(() =>
      runDocTranslations(sibling(root, { stamp: true }), ["--write", join(root, "docs/reference.md")])
    );
    assert.equal(result.code, 1);
    assert.doesNotMatch(readFileSync(join(root, "docs/reference.zh-CN.md"), "utf8"), /source-blob/);
  });

  it("handles usage errors, help, --write without stamp, and files outside the scope", () => {
    const root = cleanRepo();
    assert.equal(quiet(() => runDocTranslations(sibling(root), ["--fix"])).code, 2);
    assert.equal(quiet(() => runDocTranslations(sibling(root, { stamp: true }), ["--write"])).code, 2);
    assert.deepEqual(
      quiet(() => runDocTranslations(sibling(root), ["--help"])),
      {
        code: 0,
        lines: ["usage: doc-translations [--write <document or translation>...]"]
      }
    );
    const noStamp = quiet(() => runDocTranslations(sibling(root), ["--write", join(root, "docs/guide.md")]));
    assert.equal(noStamp.code, 2);
    assert.doesNotMatch(readFileSync(join(root, "docs/guide.zh-CN.md"), "utf8"), /source-blob/);
    const outside = quiet(() =>
      runDocTranslations(sibling(root, { stamp: true }), ["--write", join(root, "CONTRIBUTING.md")])
    );
    assert.equal(outside.code, 1);
    assert.match(
      outside.lines.join("\n"),
      /CONTRIBUTING\.md: CONTRIBUTING\.md is not a document or translation in scope under /
    );
  });
});
