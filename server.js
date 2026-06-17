import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import searchHandler from "./api/search.js";
import hotHandler from "./api/hot.js";
import analyzeHandler from "./api/analyze.js";

const root = process.cwd();
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 8080);

loadLocalEnv(".env.local");
loadLocalEnv(".env");

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
    return runApiHandler(request, response, url, searchHandler);
  }

  if (url.pathname === "/api/hot") {
    return runApiHandler(request, response, url, hotHandler);
  }

  if (url.pathname === "/api/analyze") {
    return runAnalyzeHandler(request, response, url);
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

function runApiHandler(request, response, url, handler) {
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

  return handler(apiRequest, apiResponse);
}

async function runAnalyzeHandler(request, response, url) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    // ignore
  }

  const apiRequest = {
    method: request.method,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: request.headers,
    body: parsed
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

  return analyzeHandler(apiRequest, apiResponse);
}

function loadLocalEnv(filename) {
  const envPath = join(root, filename);
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
