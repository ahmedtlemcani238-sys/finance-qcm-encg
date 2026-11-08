import { json, readBody, validUsername, blankStats, newSession } from "./_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await readBody(request);
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const passwordHash = String(body.passwordHash || "");
  if (name.length < 2) return json({ ok: false, error: "Écris ton nom complet." }, 400);
  if (!validUsername(username)) return json({ ok: false, error: "Nom d'utilisateur invalide." }, 400);
  if (passwordHash.length < 8) return json({ ok: false, error: "Mot de passe invalide." }, 400);
  if (!env.FA_KV) return json({ ok: false, error: "KV non configuré." }, 500);
  const existing = await env.FA_KV.get("user:" + username, "json");
  if (existing) return json({ ok: false, error: "Ce nom d'utilisateur existe déjà." }, 409);
  await env.FA_KV.put("user:" + username, JSON.stringify({ name, username, passHash: passwordHash, createdAt: new Date().toISOString() }));
  await env.FA_KV.put("stats:" + username, JSON.stringify(blankStats(name, username)));
  const token = await newSession(env, username);
  return json({ ok: true, token, name });
}
