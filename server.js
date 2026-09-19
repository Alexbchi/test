import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

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

function setApiCorsHeaders(response) {
  // The static page may be hosted separately from this small API service.
  // No credentials are accepted by this endpoint; the OpenAI key stays server-side.
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("Request body is not valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function readOpenAiError(openAiResponse) {
  const body = await openAiResponse.text();
  try {
    return JSON.parse(body).error?.message;
  } catch {
    return undefined;
  }
}

async function answerSearchQuestion(question, { apiKey, model, fetchImpl }) {
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured on the server.");
    error.statusCode = 503;
    throw error;
  }

  let openAiResponse;
  try {
    openAiResponse = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "Réponds en français. Donne une synthèse claire en un seul paragraphe de quatre à cinq phrases maximum. Ne commence pas par un titre, ne fais pas de liste et ne mentionne pas ces consignes.",
        input: question,
      }),
    });
  } catch {
    const error = new Error("OpenAI is unreachable.");
    error.statusCode = 502;
    throw error;
  }

  if (!openAiResponse.ok) {
    const error = new Error((await readOpenAiError(openAiResponse)) || "ChatGPT could not answer the question.");
    error.statusCode = 502;
    throw error;
  }

  const contentType = openAiResponse.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error("OpenAI returned a non-JSON response.");
    error.statusCode = 502;
    throw error;
  }

  let data;
  try {
    data = await openAiResponse.json();
  } catch {
    const error = new Error("OpenAI returned invalid JSON.");
    error.statusCode = 502;
    throw error;
  }

  const answer = data.output_text?.trim();
  if (!answer) {
    const error = new Error("ChatGPT returned an empty answer.");
    error.statusCode = 502;
    throw error;
  }

  return answer;
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
      setApiCorsHeaders(response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method !== "POST") {
        sendJson(response, 405, { error: "Utilisez POST pour appeler cette API." });
        return;
      }

      try {
        const { question } = await readJsonBody(request);
        if (typeof question !== "string" || !question.trim()) {
          sendJson(response, 400, { error: "Une question est requise." });
          return;
        }
        if (question.trim().length > 1_000) {
          sendJson(response, 400, { error: "La question doit contenir 1 000 caractères maximum." });
          return;
        }

        sendJson(response, 200, { answer: await answerSearchQuestion(question.trim(), { apiKey, model, fetchImpl }) });
      } catch (error) {
        console.error(error);
        sendJson(response, error.statusCode || 500, {
          error: error.statusCode === 503
            ? "Le service n’est pas configuré : ajoutez OPENAI_API_KEY sur le serveur."
            : error.statusCode === 400 || error.statusCode === 413
              ? error.message
              : "Impossible d’obtenir une réponse de ChatGPT pour le moment.",
        });
      }
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
