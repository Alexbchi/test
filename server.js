import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 3000);
const publicDirectory = process.cwd();
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) {
      throw new Error("Request body is too large.");
    }
  }
  return JSON.parse(body || "{}");
}

async function answerSearchQuestion(question) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
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

  if (!openAiResponse.ok) {
    throw new Error("ChatGPT could not answer the question.");
  }

  const data = await openAiResponse.json();
  const answer = data.output_text?.trim();
  if (!answer) {
    throw new Error("ChatGPT returned an empty answer.");
  }

  return answer;
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt") {
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

      sendJson(response, 200, { answer: await answerSearchQuestion(question.trim()) });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, {
        error: "Impossible d’obtenir une réponse de ChatGPT pour le moment.",
      });
    }
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

  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Search app available at http://localhost:${port}`);
});
