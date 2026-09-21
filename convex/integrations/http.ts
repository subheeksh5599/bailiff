/**
 * One HTTP helper for every vendor call.
 *
 * A vendor call is a boundary, so it gets a timeout, a user agent, JSON in and
 * JSON out, and an error that carries the vendor's own message plus the status.
 * Nothing is retried here: a retry belongs to the caller that knows whether the
 * operation is idempotent, and the billing path is the only place where that
 * matters, which is why it has its own key.
 */

export type HttpResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { token?: string; headers?: Record<string, string>; timeoutMs?: number; userAgent?: string } = {}
): Promise<HttpResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": opts.userAgent ?? "bailiff/0.1 (+https://github.com/subheeksh5599/bailiff)",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* keep the raw text: a vendor that answers with HTML is telling us something */
    }
    if (!response.ok) {
      const message =
        typeof data === "object" && data && "error" in data
          ? JSON.stringify((data as { error: unknown }).error)
          : text.slice(0, 300);
      return { ok: false, status: response.status, error: message };
    }
    return { ok: true, status: response.status, data: data as T };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "network failure" };
  } finally {
    clearTimeout(timer);
  }
}
