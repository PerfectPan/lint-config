import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const [file, expected] of [
  ["entry-subpath-type.ts", "runtime-entry"],
  ["entry-subpath-import.ts", "sdk-location"]
]) {
  const result = spawnSync(
    "./node_modules/.bin/vp",
    ["lint", "--format", "json", `packages/api/src/billing/application/cases/${file}`],
    { encoding: "utf8" }
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    report.diagnostics.map(({ message }) => message.match(/\[([^\]]+)\]/)?.[1]),
    [expected],
    `${file}: type queries retain the entry diagnostic while static imports keep the SDK location restriction`
  );
}
