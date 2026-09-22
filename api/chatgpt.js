import { handleChatGptRequest } from "../chatgpt-api.js";

// Vercel serves this function at /api/chatgpt on the same origin as index.html.
export default function handler(request, response) {
  return handleChatGptRequest(request, response);
}
