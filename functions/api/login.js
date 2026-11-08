import { json, readBody, newSession } from "./_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await readBody(request);
  const username = String(body.username || "").trim().toLowerCase();
  const passwordHash = String(body.passwordHash || "");
  if (!env.FA_KV) return json({ ok: false, error: "KV non configuré." }, 500);
  const user = await env.FA_KV.get("user:" + username, "json");
  if (!user || user.passHash !== passwordHash) {
    return json({ ok: false, error: "Nom d'utilisateur ou mot de passe incorrect." }, 401);
  }
  const token = await newSession(env, username);
  return json({ ok: true, token, name: user.name });
}
