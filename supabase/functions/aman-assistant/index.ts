const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!token || !openRouterKey) return json({ error: "Assistant is not configured" }, 503);

  const userRes = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { Authorization: "Bearer " + token, apikey: anonKey },
  });
  if (!userRes.ok) return json({ error: "Sign in required" }, 401);
  const user = await userRes.json();

  const profileRes = await fetch(supabaseUrl + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=status", {
    headers: { Authorization: "Bearer " + token, apikey: anonKey },
  });
  const profiles = profileRes.ok ? await profileRes.json() : [];
  if (!profiles[0] || profiles[0].status !== "approved") return json({ error: "Approved volunteers only" }, 403);

  let body: { query?: string; page?: string } = {};
  try { body = await req.json(); } catch (_) { return json({ error: "Invalid request" }, 400); }
  const query = String(body.query || "").trim().slice(0, 500);
  const page = String(body.page || "dashboard").slice(0, 30);
  if (!query) return json({ error: "Question required" }, 400);

  const prompt = `You are Aman, the Aman Patrol neighbourhood-watch assistant for Greenside and Emmarentia, Johannesburg. The volunteer is on the ${page} screen. Give a brief, practical answer in plain English. Safety rules are absolute: observe and report only; never confront, chase, detain, enter danger, or patrol alone. For immediate police emergencies say SAPS 10111. For medical emergencies say call an ambulance immediately; approved app contacts include Netcare 911 on 082 911 and ER24 on 084 124. Never claim live web access or current traffic information. Never request or repeat victim names, ID numbers, phone numbers, medical records, photos, or other private information. If uncertain, say so and direct the volunteer to the coordinator or emergency service. Question: ${query}`;

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + openRouterKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mia-za.github.io/aman-patrol/",
      "X-Title": "Aman Patrol",
    },
    body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "user", content: prompt }], max_tokens: 280, temperature: 0.2 }),
  });
  if (!aiRes.ok) return json({ error: "Free AI is temporarily unavailable" }, 503);
  const result = await aiRes.json();
  const answer = String(result?.choices?.[0]?.message?.content || "").trim().slice(0, 1800);
  if (!answer) return json({ error: "No answer was returned" }, 503);
  return json({ answer, source: "OpenRouter free model" });
});
