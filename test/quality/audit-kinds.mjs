// Reads the three audit reports the self-test wrote and asserts the intended pairs: the exact pair
// as kind exact, the renamed pair as kind renamed, the AST-only near-miss pair as a single
// similar/ast finding, and the behaviourally different pair absent. Run from test/quality with the
// temporary report directory as the first argument.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tmp = process.argv[2] ?? "tmp/quality-checks";
const report = (name) => JSON.parse(readFileSync(`${tmp}/${name}/jscpd-report.json`, "utf8"));
const namesOf = (clone) => [
  clone.firstFile.name.split("/").pop(),
  clone.secondFile.name.split("/").pop()
];
const describe = (clone) => `${namesOf(clone).join(" <-> ")} (${clone.kind}:${clone.method ?? "token"})`;

// The isolated exact corpus reports the identical pair as kind exact.
const exact = report("audit-exact").duplicates ?? [];
const exactPair = exact.find((clone) => namesOf(clone).sort().join(",") === "exact-a.ts,exact-b.ts");
assert.ok(exactPair !== undefined, `the exact pair must report, saw ${exact.map(describe).join("; ")}`);
assert.equal(exactPair.kind, "exact", `the identical pair must be kind exact, saw ${describe(exactPair)}`);

// The isolated renamed pair reports as kind renamed: the exact gate misses it, the audit finds it.
const renamed = report("audit-renamed").duplicates ?? [];
const renamedPair = renamed.find((clone) => namesOf(clone).sort().join(",") === "renamed-a.ts,renamed-b.ts");
assert.ok(renamedPair !== undefined, `the renamed pair must report, saw ${renamed.map(describe).join("; ")}`);
assert.equal(renamedPair.kind, "renamed", `the renamed pair must be kind renamed, saw ${describe(renamedPair)}`);

// The AST-only pair (38 tokens, below the token floor) reports through similarity alone; an
// isolated configuration without similarity reported nothing for the same corpus.
const srcAst = report("audit-src-ast").duplicates ?? [];
const similar = srcAst.filter((clone) => clone.kind === "similar" && clone.method === "ast");
assert.equal(similar.length, 1, `exactly one AST finding expected, saw ${srcAst.map(describe).join("; ")}`);
const noSimilarity = report("audit-no-similarity").duplicates ?? [];
assert.equal(noSimilarity.length, 0, "the AST finding survived an isolated config without similarity");

// Genuinely different behaviour is absent from every finding.
const flagged = new Set(srcAst.flatMap(namesOf));
assert.ok(!flagged.has("different-a.ts") && !flagged.has("different-b.ts"), `the different pair was flagged: ${[...flagged].join(", ")}`);

console.log(`audit kinds verified: exact, renamed, similar/ast (${srcAst.length} clones in the mixed scan)`);
