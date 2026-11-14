// Runs the shared Knip configuration over the fixture projects and asserts the mode differences
// explicitly: a test-only file stays alive in the ordinary run and reports in production, public
// entry exports stay quiet by default and report under the strict configuration, and the computed
// dynamic import stays unmodeled in both. Run from test/quality.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const knip = "../node_modules/.bin/knip";

const run = (cwd, args) => {
  // A finding-bearing run exits non-zero; the JSON report is the assertion input either way.
  const result = spawnSync(knip, [...args, "--reporter", "json"], { cwd, encoding: "utf8" });
  if (result.error !== undefined) {
    throw result.error;
  }
  const output = `${result.stdout}`;
  return JSON.parse(output.slice(output.indexOf("{")));
};

const filesOf = (parsed) => new Set(parsed.issues.flatMap((issue) => (issue.files ?? []).map((file) => file.name)));
const exportsOf = (parsed) =>
  new Set(parsed.issues.flatMap((issue) => (issue.exports ?? []).map((entry) => `${issue.file}:${entry.name}`)));
const dependenciesOf = (parsed) =>
  new Set(parsed.issues.flatMap((issue) => (issue.dependencies ?? []).map((dep) => dep.name)));

const ordinary = run("knip-bad", []);
assert.deepEqual(
  [...filesOf(ordinary)].sort(),
  ["src/computed-load.ts", "src/unused.ts"],
  "ordinary unused files"
);
assert.ok(!filesOf(ordinary).has("src/only-test.ts"), "ordinary: the test-only file must stay alive");
assert.ok(!filesOf(ordinary).has("src/dynamic-loader.ts"), "ordinary: the literal dynamic import stays alive");
assert.ok(!exportsOf(ordinary).has("src/helper.ts:deadExport"), "ordinary: a re-exported entry export stays protected");
assert.ok(dependenciesOf(ordinary).has("left-pad"), "ordinary: the unused dependency reports");

const production = run("knip-bad", ["--production"]);
assert.ok(filesOf(production).has("src/only-test.ts"), "production: the test-only file reports");
assert.ok(!filesOf(production).has("src/dynamic-loader.ts"), "production: the dynamic entry stays alive");
assert.ok(filesOf(production).has("src/unused.ts"), "production: the unused file still reports");

const strict = run("knip-bad", ["-c", "knip.strict.js"]);
assert.ok(exportsOf(strict).has("src/helper.ts:deadExport"), "strict: the re-exported entry export reports");
assert.ok(exportsOf(strict).has("src/index.ts:main"), "strict: entry exports are checked");

const clean = run("knip-clean", []);
assert.equal(filesOf(clean).size, 0, "clean fixture: no findings");
assert.equal(dependenciesOf(clean).size, 0, "clean fixture: no unused dependencies");

console.log("knip mode assertions verified: ordinary vs production vs strict");
