// Writes an isolated copy of the shared audit profile with the similarity pass removed, so the
// self-test can prove the AST finding needs that pass. The argument is the output path.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
assert.ok(target !== undefined && target !== "", "output path required");
const profile = JSON.parse(readFileSync("node_modules/@perfectpan/lint-config/jscpd-audit.json", "utf8"));
assert.equal(profile.similarity, 0.8, "the audit preset carries similarity 0.8");
delete profile.similarity;
writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`);
