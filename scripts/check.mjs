import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const dir of ["src", "scripts", "tests", "vendor"]) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!/\.(m?js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ["--check", path.join(root, dir, file)], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log("All JavaScript syntax checks passed.");
