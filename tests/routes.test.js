import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import uploadRoutes from "../src/routes/uploadRoutes.js";

test("Uploads require authentication before processing", async (t) => {
  const app = express(); app.use(express.json());
  app.use("/uploads", uploadRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, method] of [["/uploads", "POST"]]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 401);
    assert.match((await response.json()).message, /token/i);
  }
});
