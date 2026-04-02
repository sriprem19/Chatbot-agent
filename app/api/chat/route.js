/**
 * AgentX — Secure Gemini Proxy
 * 
 * This API route keeps the Gemini API key hidden on the server.
 * The frontend calls POST /api/chat instead of calling Google directly.
 * Model is configured in agent.config.js
 */

import config from "../../../agent.config";

export async function POST(request) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return Response.json(
      { error: "API key not configured on server" },
      { status: 500 }
    );
  }

  try {
    const { messages, systemPrompt } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const body = { contents };
    if (systemPrompt) {
      body.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const model = config.model || "gemini-2.5-flash-lite";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    // Retry logic for rate limiting
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      // Rate limited — wait and retry
      if (data.error && data.error.code === 429 && attempt < 2) {
        const delay = (attempt + 1) * 5000; // 5s, 10s
        await new Promise(r => setTimeout(r, delay));
        lastError = data.error.message;
        continue;
      }

      if (data.error) {
        return Response.json(
          { error: data.error.message, code: data.error.code },
          { status: data.error.code || 500 }
        );
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        return Response.json(
          { error: "Empty response from Gemini" },
          { status: 502 }
        );
      }

      return Response.json({ text });
    }

    // All retries exhausted
    return Response.json(
      { error: lastError || "Rate limited — please try again later", code: 429 },
      { status: 429 }
    );

  } catch (err) {
    console.error("API route error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
