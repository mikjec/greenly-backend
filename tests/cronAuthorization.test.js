import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeNotificationCron } from "../src/middlewares/cronAuthorization.js";
test("cron requires authentication without a secret and limits users to their account", () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    let allowed = false;
    const reject = authorizeNotificationCron((req, res) => { res.status = 401; });
    const res = {};
    reject({ headers: { authorization: "Bearer invalid" }, query: {} }, res, () => { allowed = true; });
    assert.equal(res.status, 401); assert.equal(allowed, false);
    const req = { headers: {}, query: {}, user: { id: 7 } };
    authorizeNotificationCron((req, res, next) => next())(req, {}, () => { allowed = true; });
    assert.equal(req.cronUserId, 7); assert.equal(allowed, true);
    process.env.CRON_SECRET = "test-only-secret";
    const scheduler = { headers: { "x-cron-secret": "test-only-secret" }, query: {} };
    reject(scheduler, {}, () => {});
    assert.equal(scheduler.cronUserId, null);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
