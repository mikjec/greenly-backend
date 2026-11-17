import * as webpush from "web-push";
import { eq, and, lte, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  pushSubscriptions,
  notifications,
  users,
  schedules,
  plants,
  microclimates,
  taskTypes,
} from "../db/schema.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT?.trim() || "mailto:kontakt@greenly-app.pl";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.warn("⚠️ Błąd konfiguracji VAPID:", err.message);
  }
} else {
  console.warn("⚠️ Brak kluczy VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — Web Push wyłączony.");
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

let ensureTablePromise = null;
let ensureNotificationsTablePromise = null;

/**
 * Zapewnia istnienie tabeli notifications w bazie.
 */
async function ensureNotificationsTable(database = db) {
  if (database !== db) return;
  if (!ensureNotificationsTablePromise) {
    ensureNotificationsTablePromise = database
      .execute(`
        CREATE TABLE IF NOT EXISTS \`notifications\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`user_id\` int NOT NULL,
          \`title\` varchar(255) NOT NULL,
          \`body\` text NOT NULL,
          \`type\` varchar(50) NOT NULL DEFAULT 'info',
          \`url\` varchar(500) NOT NULL DEFAULT '/schedules',
          \`is_read\` tinyint(1) NOT NULL DEFAULT '0',
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`notifications_user_id_idx\` (\`user_id\`, \`id\`),
          CONSTRAINT \`notifications_user_id_users_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `)
      .catch((err) => {
        ensureNotificationsTablePromise = null;
        throw err;
      });
  }
  return ensureNotificationsTablePromise;
}

/**
 * Zapisuje powiadomienie w aplikacji dla użytkownika.
 */
export async function createInAppNotification(
  { userId, title, body, type = "info", url = "/schedules" },
  database = db
) {
  await ensureNotificationsTable(database);
  const [inserted] = await database.insert(notifications).values({
    userId,
    title: String(title).slice(0, 255),
    body: String(body),
    type: String(type).slice(0, 50),
    url: String(url || "/schedules").slice(0, 500),
    isRead: false,
  });
  return inserted?.insertId ?? null;
}

/**
 * Pobiera listę powiadomień użytkownika oraz liczbę nieprzeczytanych.
 */
export async function getUserNotifications(
  userId,
  { limit = 30 } = {},
  database = db
) {
  await ensureNotificationsTable(database);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const items = await database
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.id))
    .limit(safeLimit);

  const [unreadRow] = await database
    .select({ count: sql`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return {
    notifications: items,
    unreadCount: Number(unreadRow?.count ?? 0),
  };
}

/**
 * Oznacza pojedyncze powiadomienie użytkownika jako przeczytane.
 */
export async function markNotificationAsRead(
  userId,
  notificationId,
  database = db
) {
  await ensureNotificationsTable(database);
  const [existing] = await database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .limit(1);

  if (!existing) return null;

  if (!existing.isRead) {
    await database
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      );
  }

  return { ...existing, isRead: true };
}

/**
 * Oznacza wszystkie powiadomienia użytkownika jako przeczytane.
 */
export async function markAllNotificationsAsRead(userId, database = db) {
  await ensureNotificationsTable(database);
  await database
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );
  return { updated: true };
}

/**
 * Zapewnia istnienie tabeli push_subscriptions w bazie (przydatne m.in. przy świeżym wdrożeniu na Renderze).
 */
async function ensurePushSubscriptionsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db
      .execute(`
        CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`user_id\` int NOT NULL,
          \`endpoint\` text NOT NULL,
          \`p256dh\` varchar(255) NOT NULL,
          \`auth\` varchar(255) NOT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`push_subscriptions_user_id_idx\` (\`user_id\`),
          CONSTRAINT \`push_subscriptions_user_id_users_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `)
      .catch((err) => {
        ensureTablePromise = null;
        throw err;
      });
  }
  return ensureTablePromise;
}

/**
 * Zapisuje lub aktualizuje subskrypcję Push dla danego użytkownika
 */
export async function saveSubscription(userId, subscription) {
  await ensurePushSubscriptionsTable();
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error("Nieprawidłowy format obiektu subskrypcji");
  }

  const { endpoint, keys } = subscription;
  const p256dh = keys.p256dh;
  const auth = keys.auth;

  if (!p256dh || !auth) {
    throw new Error("Brak kluczy p256dh lub auth w subskrypcji");
  }

  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ userId, p256dh, auth })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db.insert(pushSubscriptions).values({
    userId,
    endpoint,
    p256dh,
    auth,
  });

  return inserted.insertId;
}

/**
 * Usuwa subskrypcję push (np. po wylogowaniu lub wyłączeniu)
 */
export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await ensurePushSubscriptionsTable();
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Wysyła powiadomienie do pojedynczego rekordu subskrypcji
 */
export async function sendNotificationToSubscription(subRow, payload) {
  const pushConfig = {
    endpoint: subRow.endpoint,
    keys: {
      p256dh: subRow.p256dh,
      auth: subRow.auth,
    },
  };

  const payloadString =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  try {
    await webpush.sendNotification(pushConfig, payloadString);
    return true;
  } catch (error) {
    // 404 lub 410 oznacza, że subskrypcja wygasła / użytkownik usunął uprawnienia
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log(
        `[PUSH] Subskrypcja wygasła (${error.statusCode}), usuwanie:`,
        subRow.endpoint.slice(0, 40) + "..."
      );
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subRow.id));
    } else {
      console.error(
        "[PUSH] Błąd wysyłania powiadomienia:",
        error.message || error
      );
    }
    return false;
  }
}

/**
 * Wysyła powiadomienie do wszystkich zarejestrowanych urządzeń danego użytkownika
 */
export async function sendNotificationToUser(userId, payload) {
  await ensurePushSubscriptionsTable();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    return { sent: 0, total: 0 };
  }

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendNotificationToSubscription(sub, payload);
    if (ok) sent++;
  }

  return { sent, total: subs.length };
}

export function buildCareNotificationPayload(userTasks, mode = "morning") {
  const taskCount = userTasks.length;
  const samplePlants = userTasks
    .slice(0, 3)
    .map((t) => `${t.plantName} (${t.taskLabel.toLowerCase()})`)
    .join(", ");
  const andMore = taskCount > 3 ? ` i ${taskCount - 3} więcej` : "";
  const taskWord =
    taskCount === 1 ? "zadanie" : taskCount < 5 ? "zadania" : "zadań";
  const today = new Date().toISOString().slice(0, 10);

  if (mode === "reminder") {
    const verb = taskCount === 1 ? "czeka" : taskCount < 5 ? "czekają" : "czeka";
    return {
      title: "🌙 Greenly: Przypomnienie o pielęgnacji",
      body: `Nadal ${verb} na Ciebie ${taskCount} ${taskWord}: ${samplePlants}${andMore}. Pamiętaj o roślinach przed końcem dnia!`,
      icon: "/icon-192.png",
      badge: "/favicon.svg",
      tag: `greenly-care-reminder-${today}`,
      data: {
        url: "/schedules",
        taskCount,
        mode: "reminder",
      },
    };
  }

  return {
    title: "🌱 Greenly: Czas na pielęgnację!",
    body: `Dzisiaj czeka na Ciebie ${taskCount} ${taskWord}: ${samplePlants}${andMore}.`,
    icon: "/icon-192.png",
    badge: "/favicon.svg",
    tag: `greenly-care-${today}`,
    data: {
      url: "/schedules",
      taskCount,
      mode: "morning",
    },
  };
}

/**
 * Sprawdza zadania pielęgnacyjne wypadające na dzisiaj i wysyła powiadomienia Push
 * Może być wywoływane przez CRON lub manualny endpoint
 */
export async function checkDueCareAndSendNotifications(
  targetUserId = null,
  { mode = "morning" } = {}
) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Pobierz aktywne harmonogramy z terminem <= koniec dzisiejszego dnia
  const rows = await db
    .select({
      scheduleId: schedules.id,
      nextDueDate: schedules.nextDueDate,
      plantId: plants.id,
      plantName: plants.nickname,
      taskLabel: taskTypes.label,
      taskKey: taskTypes.key,
      userId: microclimates.userId,
    })
    .from(schedules)
    .innerJoin(plants, eq(schedules.plantId, plants.id))
    .innerJoin(microclimates, eq(plants.microclimateId, microclimates.id))
    .innerJoin(taskTypes, eq(schedules.taskTypeId, taskTypes.id))
    .where(
      and(
        eq(schedules.active, true),
        eq(plants.active, true),
        lte(schedules.nextDueDate, endOfToday)
      )
    );

  // Filtruj według targetUserId, jeśli podano
  const filteredRows = targetUserId
    ? rows.filter((r) => r.userId === targetUserId)
    : rows;

  if (filteredRows.length === 0) {
    return {
      message: "Brak zadań pielęgnacyjnych wymagających powiadomienia.",
      checkedTasks: 0,
      notificationsSent: 0,
    };
  }

  // Pogrupuj zadania według użytkownika
  const tasksByUser = new Map();
  for (const row of filteredRows) {
    if (!tasksByUser.has(row.userId)) {
      tasksByUser.set(row.userId, []);
    }
    tasksByUser.get(row.userId).push(row);
  }

  let totalNotificationsSent = 0;
  const userResults = [];

  for (const [userId, userTasks] of tasksByUser.entries()) {
    const taskCount = userTasks.length;
    const notificationPayload = buildCareNotificationPayload(userTasks, mode);

    await createInAppNotification({
      userId,
      title: notificationPayload.title,
      body: notificationPayload.body,
      type: mode === "reminder" ? "reminder" : "care",
      url: "/schedules",
    }).catch((err) => {
      console.error("[IN-APP] Błąd zapisu powiadomienia:", err.message);
    });

    const { sent, total } = await sendNotificationToUser(
      userId,
      notificationPayload
    );

    totalNotificationsSent += sent;
    userResults.push({
      userId,
      taskCount,
      devicesNotified: sent,
      totalDevices: total,
    });
  }

  return {
    message: `Przetworzono zadania dla ${tasksByUser.size} użytkowników. Wysłano ${totalNotificationsSent} powiadomień.`,
    checkedTasks: filteredRows.length,
    usersCount: tasksByUser.size,
    notificationsSent: totalNotificationsSent,
    details: userResults,
  };
}

export default {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  createInAppNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  sendNotificationToUser,
  sendNotificationToSubscription,
  checkDueCareAndSendNotifications,
};
