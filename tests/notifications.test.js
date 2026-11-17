import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import notificationRoutes from "../src/routes/notificationRoutes.js";
import { pool } from "../src/db/index.js";
import {
  getVapidPublicKey,
  buildCareNotificationPayload,
  createInAppNotification,
  getUserNotifications,
  markNotificationAsRead,
} from "../src/services/notificationService.js";

test("Notification service exports valid VAPID public key", () => {
  const key = getVapidPublicKey();
  assert.ok(typeof key === "string" && key.length > 20, "VAPID key should be a valid string");
});

test("Notification endpoints require authentication", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/notifications", notificationRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, method] of [
    ["/notifications", "GET"],
    ["/notifications/read-all", "PATCH"],
    ["/notifications/1/read", "PATCH"],
  ]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 401);
  }
});

test("PATCH /notifications/:id/read rejects malformed IDs", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/notifications", notificationRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const secret = process.env.JWT_SECRET || "supersecretgreenlyjwtkey_2026";
  const token = jwt.sign({ id: 1, email: "test@example.com" }, secret);
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${base}/notifications/not-a-number/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 400);
});

test("In-app notification helpers create, list and mark as read", async () => {
  const insertedValues = [];
  const updatedRows = [];
  const fakeRows = [
    { id: 10, userId: 7, title: "Podlej", body: "Monstera", type: "care", url: "/schedules", isRead: false },
  ];

  const fakeDb = {
    insert: () => ({
      values: async (val) => {
        insertedValues.push(val);
        return [{ insertId: 11 }];
      },
    }),
    select: (fields) => ({
      from: () => ({
        where: () => {
          if (fields && "count" in fields) {
            return Promise.resolve([{ count: 1 }]);
          }
          return {
            orderBy: () => ({
              limit: async () => fakeRows,
            }),
            limit: async () => fakeRows,
          };
        },
      }),
    }),
    update: () => ({
      set: (val) => ({
        where: async () => {
          updatedRows.push(val);
        },
      }),
    }),
  };

  const newId = await createInAppNotification(
    { userId: 7, title: "Test", body: "Treść", type: "test", url: "/profile" },
    fakeDb
  );
  assert.equal(newId, 11);
  assert.equal(insertedValues[0].userId, 7);
  assert.equal(insertedValues[0].isRead, false);

  const list = await getUserNotifications(7, { limit: 20 }, fakeDb);
  assert.equal(list.notifications.length, 1);
  assert.equal(list.unreadCount, 1);

  const marked = await markNotificationAsRead(7, 10, fakeDb);
  assert.equal(marked.isRead, true);
  assert.deepEqual(updatedRows[0], { isRead: true });
});

test("buildCareNotificationPayload differentiates morning and reminder modes", () => {
  const tasks = [{ plantName: "Monstera", taskLabel: "Podlewanie" }];
  const morning = buildCareNotificationPayload(tasks, "morning");
  const reminder = buildCareNotificationPayload(tasks, "reminder");

  assert.match(morning.title, /Czas na pielęgnację/);
  assert.match(morning.tag, /^greenly-care-\d{4}-\d{2}-\d{2}$/);
  assert.equal(morning.data.mode, "morning");

  assert.match(reminder.title, /Przypomnienie o pielęgnacji/);
  assert.match(reminder.tag, /^greenly-care-reminder-\d{4}-\d{2}-\d{2}$/);
  assert.equal(reminder.data.mode, "reminder");
});

test.after(async () => {
  await pool?.end?.();
});
