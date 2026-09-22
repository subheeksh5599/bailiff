/**
 * The one response helper the routes share.
 *
 * Every route answers with JSON, including the ones that answer with a refusal, so
 * the shape a caller sees does not depend on which kind of route they reached.
 */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
