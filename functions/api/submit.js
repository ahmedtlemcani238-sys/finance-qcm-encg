import { json, readBody, getSession, ACH, achUnlocked, blankStats } from "./_shared.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await readBody(request);
  const session = await getSession(env, body.token);
  if (!session) return json({ ok: false, error: "Session invalide. Reconnecte-toi." }, 401);
  const result = body.result || {};
  const username = session.username;
  let stats = (await env.FA_KV.get("stats:" + username, "json")) || blankStats("", username);
  const correct = result.correctCount != null ? result.correctCount : (result.score || 0);
  const wrong = result.incorrectCount != null ? result.incorrectCount : 0;
  const unans = result.unansweredCount != null ? result.unansweredCount : 0;
  stats.totalCorrect += correct;
  stats.totalWrong += wrong;
  stats.totalUnanswered += unans;
  stats.totalAnswered += correct + wrong + unans;
  stats.sessions += 1;
  if (correct > (stats.bestScore || 0)) stats.bestScore = correct;
  if ((result.percentage || 0) > (stats.bestPercentage || 0)) stats.bestPercentage = result.percentage;
  if (result.mode === "exam" && result.percentage === 100 && (result.totalQuestions || 0) >= 10) {
    stats.perfectExams = (stats.perfectExams || 0) + 1;
  }
  stats.lastPlayedAt = new Date().toISOString();
  await env.FA_KV.put("stats:" + username, JSON.stringify(stats));

  let unlocked = (await env.FA_KV.get("ach:" + username, "json")) || [];
  const newly = [];
  for (const a of ACH) {
    if (!unlocked.includes(a.id) && achUnlocked(a, stats)) { unlocked.push(a.id); newly.push(a.title); }
  }
  if (newly.length) await env.FA_KV.put("ach:" + username, JSON.stringify(unlocked));
  return json({ ok: true, stats, unlockedNames: newly });
}
