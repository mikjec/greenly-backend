import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] || "all";
if (!["all", "unit", "integration"].includes(mode)) {
  throw new Error("Dostępne zestawy: all, unit, integration");
}
const groups = mode === "all" ? ["unit", "integration"] : [mode];
const files = groups.flatMap((group) =>
  readdirSync(new URL(`../tests/${group}/`, import.meta.url))
    .filter((name) => name.endsWith(".test.js"))
    .sort().map((name) => `tests/${group}/${name}`),
);
const result = spawnSync(process.execPath, [
  "--import", "./tests/setup.js", "--test", "--test-reporter=spec",
  ...files,
], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
