import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./server.js";

async function withServer(options, run) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("the chat endpoint always returns JSON when OpenAI returns HTML", async () => {
  await withServer({
    apiKey: "test-key",
    fetchImpl: async () => new Response("<html>Bad gateway</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chatgpt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Bonjour" }),
    });

    assert.equal(response.status, 502);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), {
      error: "Impossible d’obtenir une réponse de ChatGPT pour le moment.",
    });
  });
});

test("invalid client JSON produces a JSON validation error", async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chatgpt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), { error: "Request body is not valid JSON." });
  });
});

test("the chat endpoint accepts cross-origin requests from a static page", async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chatgpt`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://site-statique.example",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-methods"), /POST/);
    assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/);
  });
});

test("a missing API key is reported without exposing a browser-side key", async () => {
  await withServer({ apiKey: "" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chatgpt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Bonjour" }),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Le service n’est pas configuré : ajoutez OPENAI_API_KEY sur le serveur.",
    });
  });
});
