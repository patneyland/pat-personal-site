import { NextRequest } from "next/server";

import { buildSystemPrompt, readVoice } from "@/lib/gary/prompt";
import {
  GARY_MODEL,
  MAX_INPUT_CHARS,
  MAX_TOKENS,
  MAX_TURNS,
} from "@/lib/gary/model";

/** fs is used to read the corpus, so this cannot run on the edge. */
export const runtime = "nodejs";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * The prompt is identical for every visitor and reads from disk, so build it
 * once per server instance rather than per request. In production the content
 * files cannot change without a deploy, which restarts the instance anyway.
 */
let cached: Promise<string | null> | null = null;
function systemPrompt() {
  if (process.env.NODE_ENV === "development") return buildSystemPrompt();
  cached ??= buildSystemPrompt();
  return cached;
}

/**
 * Crude per-instance rate limit. Serverless means each instance keeps its own
 * counter, so this is a speed bump rather than a wall. It is enough to stop a
 * bored visitor holding the key open, which is the realistic threat to a
 * personal site.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear(); // never let the map grow without bound
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  }

  // The gate: no voice in content/gary.md, no Gary.
  const voice = readVoice();
  if (!voice.ok) {
    return new Response(voice.reason, { status: 503 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) {
    return new Response("Too many messages. Give it a minute.", {
      status: 429,
    });
  }

  let body: { messages?: Msg[]; pathname?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(
      (m): m is Msg =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_INPUT_CHARS) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("Bad request", { status: 400 });
  }

  const system = await systemPrompt();
  if (!system) return new Response("Gary is not configured", { status: 503 });

  // Where the visitor is standing, so "what is this?" has an answer. Sent as an
  // assistant-side note rather than inside the visitor's message, so it cannot
  // be mistaken for something they typed.
  const pathname =
    typeof body.pathname === "string" ? body.pathname.slice(0, 120) : "";

  const upstream = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // OpenRouter shows these on the activity page. Useful for telling this
      // traffic apart from anything else on the account.
      "HTTP-Referer": "https://www.patrickneyland.com",
      "X-Title": "Gary on patrickneyland.com",
    },
    body: JSON.stringify({
      model: GARY_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: [
        {
          role: "system",
          // The array form carries the cache breakpoint. Anthropic models
          // through OpenRouter need it explicitly; providers that cache
          // automatically ignore it.
          content: [
            {
              type: "text",
              text: system,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        ...(pathname
          ? [
              {
                role: "system" as const,
                content: `The visitor is currently on the page ${pathname}.`,
              },
            ]
          : []),
        ...messages,
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("openrouter error", upstream.status, detail.slice(0, 500));
    return new Response("Gary could not answer just now.", { status: 502 });
  }

  // Unwrap the OpenAI-shaped SSE into plain text, so the client does not need
  // to know anything about the provider's frame format.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // OpenRouter sends periodic comment lines to hold the connection
              // open. Anything unparseable is not content, so skip it.
            }
          }
        }
      } catch (err) {
        console.error("gary stream failed", err);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
