import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { handleChatGptRequest } from "./chatgpt-api.js";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function createApp({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || "gpt-4.1-mini",
  fetchImpl = fetch,
  publicDirectory = process.cwd(),
} = {}) {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/chatgpt") {
      await handleChatGptRequest(request, response, { apiKey, model, fetchImpl });
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "Route API introuvable." });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD, POST" });
      response.end();
      return;
    }

    const path = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = normalize(join(publicDirectory, path));
    if (!(filePath === publicDirectory || filePath.startsWith(`${publicDirectory}/`)) || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      ...(extname(filePath) === ".html" ? { "Cache-Control": "no-cache" } : {}),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`Search app available at http://localhost:${port}`);
  });
}
