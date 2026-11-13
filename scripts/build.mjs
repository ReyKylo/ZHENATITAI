import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
// Sources intentionally use one-line native imports and named exports, without a transpiler.
const files = ["vendor/react-runtime.js", "src/config.js", "src/core.js", "src/cloud.js", "src/storage.js", "src/i18n.js", "src/app.js", "src/auth.js", "src/main.js"];
const parts = await Promise.all(files.map(async (file) => {
  const code = await readFile(path.join(root, file), "utf8");
  return `// ${file}\n` + code.replace(/^import .+;\r?\n/gm, "").replace(/^export \{[^\n]+\};?\r?\n?/gm, "").replace(/^export /gm, "");
}));
const css = await readFile(path.join(root, "styles/app.css"), "utf8");
const template = await readFile(path.join(root, "index.html"), "utf8");
const script = parts.join("\n\n").replace(/<\/script/gi, "<\\/script");
const html = template
  .replace('<link rel="stylesheet" href="./styles/app.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./src/main.js"></script>', () => `<script>(() => {\n${script}\n})();</script>`);
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist/index.html"), html);
const offline = html.replace(/const config = \{[\s\S]*?\n\};/, 'const config = { url: "", publishableKey: "" };');
if (offline === html) throw Error("Offline configuration substitution failed.");
await writeFile(path.join(root, "dist/offline.html"), offline);
console.log(`Built dist/index.html (${Buffer.byteLength(html).toLocaleString()} bytes) and dist/offline.html; no CDN required.`);
