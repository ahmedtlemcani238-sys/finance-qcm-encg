import { json } from "./_shared.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.FA_KV) return json({ ok: false, error: "KV non configuré." }, 500);
  const list = await env.FA_KV.list({ prefix: "stats:" });
  const entries = [];
  for (const key of list.keys) {
    const s = await env.FA_KV.get(key.name, "json");
    if (!s) continue;
    const ans = (s.totalCorrect || 0) + (s.totalWrong || 0);
    entries.push({
      name: s.name, username: s.username,
      totalCorrect: s.totalCorrect || 0, totalWrong: s.totalWrong || 0,
      accuracy: ans > 0 ? Math.round((s.totalCorrect / ans) * 100) : 0,
      points: (s.totalCorrect || 0) * 10, sessions: s.sessions || 0,
    });
  }
  entries.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || a.sessions - b.sessions);
  return json({ ok: true, entries });
}
