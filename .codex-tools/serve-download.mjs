import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, resolve } from "node:path";

const filePath = resolve(process.env.PHONE_AGENT_DOWNLOAD_FILE ?? "");
const port = Number(process.env.PHONE_AGENT_DOWNLOAD_PORT ?? "8787");
const fileName = basename(filePath);

function sendFile(req, res) {
  const stat = statSync(filePath);
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { "Content-Length": stat.size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  if (path === "/" || path === `/${fileName}` || path === "/phone-agent-latest-debug.zip") {
    sendFile(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${filePath} on http://127.0.0.1:${port}/phone-agent-latest-debug.zip`);
});
