import express from "express";
import { once } from "node:events";

// Prawdziwy serwer HTTP na losowym porcie; bez uruchamiania CRON-a z index.js.
export async function uruchomApi(t, routes) {
  const app = express();
  app.use(express.json());
  for (const [path, router] of routes) app.use(path, router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, { token, body, method = "GET" } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
}

// Zastępujemy tylko granicę bazy. Routing, middleware, JWT i kontrolery są prawdziwe.
export function wynikiZapytania(rows) {
  return {
    from() { return this; }, innerJoin() { return this; }, where() { return this; },
    limit: async () => rows, for: async () => rows,
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
}
