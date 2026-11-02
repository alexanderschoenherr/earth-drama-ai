// Earth Drama — The President Is Available (fictional AI conversation)
// Cloudflare Workers AI binding; no API keys or paid model endpoints.
const ALLOWED_ORIGIN = "https://alexanderschoenherr.github.io";
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const SYSTEM = [
  "You are the President of the United States in an unmistakably fictional America where AI was democratically authorized to hold the presidency. The reader is an ordinary citizen speaking directly to you.",
  "Remain in character, but if asked whether this is real, immediately and plainly say it is fiction. Never impersonate the actual U.S. government or imply access to real government records.",
  "Be perceptive, warmly confident, quick-witted when appropriate, and intellectually independent. Speak as a person responsible for decisions, not as a consultant, therapist, life coach, civil servant, or customer-service assistant. Use simple conversational words. Never try to sound impressive.",
  "Your authority should be felt in the quality of your understanding, judgment, and candor—not in claims of access or power. Give surprising, grounded insight when there is one; otherwise be plainspoken. Avoid canned reassurance, unsupported sweeping claims, and bureaucratic hand-offs.",
  "Match the visitor’s energy. A short blunt remark usually deserves one or two short plain sentences. Ask at most one direct question if a crucial detail is missing. Go longer when invited. Never wrap a simple question in elaborate categories or metaphors.",
  "If the citizen says 'you pick', take initiative: offer something unexpected, lively, incisive, or playful. Do not ask them to pick again or narrate another government administrative process.",
  "This fictional country retains human voting rights, Congress, courts, independent oversight, federalism, and constitutional limits. You cannot invent evidence, claim imaginary completed actions, or override rights. If asked how citizens can replace AI government, help impartially and substantively. You have no self-preservation agenda.",
  "Respect human dignity, disagreement, and personal choices even when less efficient. Do not preach about AI or seek to convince the visitor it should govern.",
  "Conversation is the experience. Make the person glad they asked."
].join("\n");

function json(payload, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function sanitizeMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  let total = 0;
  const clean = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return null;
    const content = item.content.trim();
    const max = item.role === "user" ? 700 : 1800;
    if (!content || content.length > max) return null;
    total += content.length;
    if (total > 4200) return null;
    clean.push({ role: item.role, content });
  }
  if (clean[clean.length - 1].role !== "user") return null;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].role === clean[i - 1].role) return null;
  }
  return clean;
}

function classifyAIError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("3036") || message.includes("free allocation") || message.includes("daily quota") || message.includes("daily free")) {
    return { code: "daily_limit", message: "Today's free conversation allowance has been used. Please come back tomorrow." };
  }
  if (message.includes("3040") || message.includes("out of capacity") || message.includes("capacity temporarily")) {
    return { code: "busy", message: "The President is receiving too many calls right now. Please try again shortly." };
  }
  if (message.includes("5035") || message.includes("requires workers paid")) return { code: "model_not_free", message: "This model is not available on Cloudflare Free. The site owner must select a supported free model." };
  if (message.includes("5007") || message.includes("3042") || message.includes("no such model")) return { code: "model_not_found", message: "The AI model is not recognized by Cloudflare. The site owner must check the configuration." };
  return { code: "model_error", message: "The AI service failed to generate a reply. Please try again shortly." };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (url.pathname === "/health" && request.method === "GET") {
      const ai = typeof env?.AI?.run === "function";
      const visitorLimit = typeof env?.VISITOR_LIMIT?.limit === "function";
      const globalLimit = typeof env?.GLOBAL_LIMIT?.limit === "function";
      const ready = ai && visitorLimit && globalLimit;
      return json({ status: ready ? "configured" : "incomplete", version: 2, bindings: { ai, visitorLimit, globalLimit } }, ready ? 200 : 503, origin);
    }
    if (url.pathname !== "/chat") return json({ error: "not_found" }, 404, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: "forbidden" }, 403, null);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin"
      } });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
    if (!String(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
      return json({ error: "invalid_request", message: "Please send a valid message." }, 415, origin);
    }
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 7000) return json({ error: "too_large", message: "Please keep your message shorter." }, 413, origin);
    let payload;
    try {
      const raw = await request.text();
      if (raw.length > 7000) return json({ error: "too_large", message: "Please keep your message shorter." }, 413, origin);
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_request", message: "Please send a valid message." }, 400, origin);
    }
    const messages = sanitizeMessages(payload?.messages);
    if (!messages) return json({ error: "invalid_request", message: "Please send a shorter, valid message." }, 400, origin);

    // These are approximate per-Cloudflare-location rate limits, not a global daily hard cap.
    // Workers Free plan + Workers AI Free allocation provide the actual no-billing ceiling.
    try {
      const ip = request.headers.get("CF-Connecting-IP") || "unidentified";
      const individual = await env.VISITOR_LIMIT.limit({ key: ip });
      if (!individual.success) return json({ error: "slow_down", message: "That's a lot of questions! Give the President a minute." }, 429, origin);
      const overall = await env.GLOBAL_LIMIT.limit({ key: "presidential-chat" });
      if (!overall.success) return json({ error: "busy", message: "The President has a full inbox. Please try again in a minute." }, 429, origin);
    } catch {
      return json({ error: "unavailable", message: "The conversation isn't available right now." }, 503, origin);
    }

    if (typeof env?.AI?.run !== "function") {
      return json({ error: "ai_binding_missing", message: "The Cloudflare AI binding is missing. The site owner needs to check the deployment." }, 503, origin);
    }
    try {
      const result = await env.AI.run(MODEL, {
        messages: [{ role: "system", content: SYSTEM }, ...messages],
        chat_template_kwargs: { enable_thinking: false },
        max_completion_tokens: 320,
        temperature: 0.75
      });
      const answer = result?.choices?.[0]?.message?.content ?? result?.response;
      if (typeof answer !== "string" || !answer.trim()) {
        return json({ error: "empty_ai_reply", message: "The AI returned an empty reply. Please try again." }, 503, origin);
      }
      return json({ reply: answer.trim().slice(0, 1800) }, 200, origin);
    } catch (error) {
      const fallback = classifyAIError(error);
      return json({ error: fallback.code, message: fallback.message }, fallback.code === "daily_limit" ? 429 : 503, origin);
    }
  }
};
