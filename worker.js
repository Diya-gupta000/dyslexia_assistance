/**
 * Second Look -- AI backend (Cloudflare Worker)
 *
 * This is the one piece that has to live on a server instead of in the
 * browser: it holds your real OpenAI API key and makes the actual model
 * call, so a public visitor's browser never sees the key. The page sends it
 * an already-written prompt and gets back the model's raw text reply; all
 * the "what should the prompt say" logic stays in index.html so you can
 * tweak wording without redeploying this file.
 *
 * Deploy: see README-deploy.md in this same folder for the full walkthrough.
 * You will set OPENAI_API_KEY yourself, directly in the Cloudflare
 * dashboard or via `wrangler secret put` -- never paste it into this file,
 * and never send it to anyone (including Claude) to type in for you.
 */

const DEFAULT_MODEL = "gpt-5-mini";
// This endpoint is public and unauthenticated -- anyone can POST to it directly,
// not just through index.html's JS. Without this allow-list, a visitor could
// pass model:"gpt-5" (or any pricier model) straight in the request body and
// run up your OpenAI bill on a model this app never intended to use. Any
// requested model outside this list is ignored in favor of DEFAULT_MODEL.
const ALLOWED_MODELS = ["gpt-5-mini", "gpt-5-nano"];
const MAX_PROMPT_CHARS = 8000;     // guards against someone sending huge/abusive requests
const MAX_TOKENS_CAP = 3000;       // hard ceiling regardless of what the client asks for
// A data: URL for a photo upload (JPG/PNG) -- base64 runs about 4/3 the size of the raw
// image, so this caps the *decoded* image at a few MB, which is plenty for a phone photo
// of a page. Guards against someone POSTing a huge file straight at this endpoint (it's
// public and unauthenticated) and running up cost/latency on a single request.
const MAX_IMAGE_DATA_URL_CHARS = 7_000_000;
// gpt-5-family models spend part of max_completion_tokens on invisible internal
// reasoning before writing the visible reply -- for straightforward tasks like
// ours (read a sentence, return small JSON) that reasoning is pure overhead and
// can even eat the whole budget, leaving an empty reply. "minimal" tells the
// model to skip most of that and go straight to answering.
const REASONING_EFFORT = "minimal";

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/ai") {
      return json({ error: "not_found" }, 404, cors);
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }
    if (!env.OPENAI_API_KEY) {
      // you deployed the Worker but haven't set the secret yet -- see README-deploy.md
      return json({ error: "server_not_configured" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad_request" }, 400, cors);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT_CHARS) : "";
    if (!prompt.trim()) {
      return json({ error: "empty_prompt" }, 400, cors);
    }
    // Optional: a photo upload (Write tab's "Upload a file" for a JPG/PNG) sends the image
    // alongside the transcription prompt as a data: URL. Only plain image/jpeg and image/png
    // data URLs are accepted -- anything else (wrong shape, wrong scheme, an SVG that could
    // carry a script) is rejected outright rather than forwarded to OpenAI as-is.
    let image = null;
    if (typeof body.image === "string" && body.image.length) {
      if (body.image.length > MAX_IMAGE_DATA_URL_CHARS) {
        return json({ error: "image_too_large" }, 413, cors);
      }
      if (!/^data:image\/(png|jpe?g);base64,/.test(body.image)) {
        return json({ error: "bad_image" }, 400, cors);
      }
      image = body.image;
    }
    // Vision requests always go to gpt-5-mini regardless of what's requested -- gpt-5-nano
    // isn't a vision-capable model, and this endpoint is public/unauthenticated so the
    // client's requested model can't be trusted to be sensible on its own.
    const model = image
      ? "gpt-5-mini"
      : (typeof body.model === "string" && ALLOWED_MODELS.indexOf(body.model) !== -1 ? body.model : DEFAULT_MODEL);
    const maxTokens = Math.min(
      Number.isFinite(body.maxTokens) ? Math.max(1, Math.floor(body.maxTokens)) : 800,
      MAX_TOKENS_CAP
    );
    const messageContent = image
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image } },
        ]
      : prompt;

    let openaiResp;
    try {
      openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          // gpt-5-family models reject the older "max_tokens" param and
          // require "max_completion_tokens" instead (OpenAI returns a
          // clear "unsupported_parameter" error if you get this wrong).
          max_completion_tokens: maxTokens,
          reasoning_effort: REASONING_EFFORT,
          messages: [{ role: "user", content: messageContent }],
        }),
      });
    } catch (e) {
      return json({ error: "upstream_network_error" }, 502, cors);
    }

    if (openaiResp.status === 429) {
      // pass OpenAI's own rate-limit signal straight through so the page
      // can show "try again in a bit" instead of a generic failure
      return json({ error: "rate_limited" }, 429, cors);
    }
    if (!openaiResp.ok) {
      const detail = await safeText(openaiResp);
      // surfaced (truncated) so a wrong/retired model name shows up as a readable
      // error instead of a silent failure -- OpenAI's model lineup shifts over time,
      // check https://platform.openai.com/docs/models if this ever complains about DEFAULT_MODEL
      return json({ error: "upstream_error", detail: detail.slice(0, 500) }, 502, cors);
    }

    let data;
    try {
      data = await openaiResp.json();
    } catch (e) {
      return json({ error: "upstream_bad_json" }, 502, cors);
    }
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    // Pass OpenAI's own token-usage numbers back to the page. The page uses
    // these (not a guess) to track real spend per browser session and stop
    // calling the AI once a visitor's session has used up its budget --
    // see the SESSION_BUDGET_USD constant in index.html.
    const usage = data.usage || null;
    return json({ text: text, usage: usage, model: model }, 200, cors);
  },
};

function corsHeaders(env, request) {
  // ALLOWED_ORIGIN accepts one origin or a comma-separated allow-list. Return the
  // requesting origin only when it is explicitly allowed; otherwise the browser
  // receives the first configured origin and blocks the response.
  const allowed = (env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = request.headers.get("Origin") || "";
  const origin = allowed.includes("*")
    ? "*"
    : (allowed.includes(requestOrigin) ? requestOrigin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
  });
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch (e) {
    return "";
  }
}
