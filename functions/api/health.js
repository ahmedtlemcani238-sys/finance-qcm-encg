export async function onRequest(context) {
  return new Response(JSON.stringify({ ok: true, mode: "cloud" }), {
    headers: { "Content-Type": "application/json" },
  });
}
