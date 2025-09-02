// Netlify Function mínima de prueba
export async function handler() {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true, msg: "hello from functions" }),
  };
}
