// Successful responses only; concurrent identical requests share one upstream call.
export function createRequestCache({
  ttlMs = 10 * 60 * 1000,
  maxEntries = 200,
  now = Date.now,
} = {}) {
  const entries = new Map();
  const pending = new Map();
  return async (key, load) => {
    const cached = entries.get(key);
    if (cached && cached.expires > now()) return cached.value;
    entries.delete(key);
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve()
      .then(load)
      .then((value) => {
        if (entries.size >= maxEntries)
          entries.delete(entries.keys().next().value);
        entries.set(key, { value, expires: now() + ttlMs });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
