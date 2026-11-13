import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const port = Number(option("--port") || process.env.PORT || 5173);
const host = option("--host") || "0.0.0.0";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).some((part) => part.startsWith("."))) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (!(await stat(file)).isFile()) throw Error("Not found");
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, host, () => console.log(`ZHEN ATITAI ready at http://${host}:${port}`));
