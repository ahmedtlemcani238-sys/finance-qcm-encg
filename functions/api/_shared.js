export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
export function validUsername(u) {
  return typeof u === "string" && /^[a-z0-9._-]{3,20}$/.test(u);
}
export function blankStats(name, username) {
  return { name, username, totalCorrect: 0, totalWrong: 0, totalUnanswered: 0, totalAnswered: 0, sessions: 0, bestScore: 0, bestPercentage: 0, perfectExams: 0, lastPlayedAt: null };
}
export const ACH = [
  { id: "bronze", title: "Bronze", kind: "correct", target: 1 },
  { id: "silver", title: "Argent", kind: "correct", target: 20 },
  { id: "gold", title: "Or", kind: "correct", target: 50 },
];
export function achUnlocked(a, stats) {
  return (stats.totalCorrect || 0) >= a.target;
}
export async function getSession(env, token) {
  if (!token) return null;
  return await env.FA_KV.get("session:" + token, "json");
}
export async function newSession(env, username) {
  const token = crypto.randomUUID();
  await env.FA_KV.put("session:" + token, JSON.stringify({ username, createdAt: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 7 });
  return token;
}
