import test from "node:test";
import assert from "node:assert/strict";
import { getVapidPublicKey } from "../src/services/notificationService.js";

test("Notification service exports valid VAPID public key", () => {
  const key = getVapidPublicKey();
  assert.ok(typeof key === "string" && key.length > 20, "VAPID key should be a valid string");
});
