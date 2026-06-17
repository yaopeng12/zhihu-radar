import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import searchHandler from "./api/search.js";

const root = process.cwd();
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/search") {
    return runApiHandler(request, response, url);
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicRoot, safePath);

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
}).listen(port, () => {
  console.log(`Zhihu Radar listening on http://localhost:${port}`);
});

function runApiHandler(request, response, url) {
  const query = Object.fromEntries(url.searchParams.entries());
  const apiRequest = {
    method: request.method,
    query,
    headers: request.headers
  };

  const apiResponse = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      response.writeHead(this.statusCode, {
        "content-type": "application/json; charset=utf-8"
      });
      response.end(JSON.stringify(payload));
    }
  };

  return searchHandler(apiRequest, apiResponse);
}
