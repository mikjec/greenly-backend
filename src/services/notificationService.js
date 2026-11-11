import * as webpush from "web-push";
import { eq, and, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  pushSubscriptions,
  users,
  schedules,
  plants,
  microclimates,
  taskTypes,
} from "../db/schema.js";

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BPesvUGnmGPWNLD4SZarLzbBgRS7maZUkoIYumkiOGMRPJEUZEvYGRKkA94PkNM-RSsgClv3v-eZftw9OSE4gUo";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "JACjuzlWbV3iCLnNLiAILqAMNYwvvAVTE1WnmtsiqPs";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:kontakt@greenly.local";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("⚠️ Błąd konfiguracji VAPID:", err.message);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Zapisuje lub aktualizuje subskrypcję Push dla danego użytkownika
 */
export async function saveSubscription(userId, subscription) {
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

/**
 * Sprawdza zadania pielęgnacyjne wypadające na dzisiaj i wysyła powiadomienia Push
 * Może być wywoływane przez CRON lub manualny endpoint
 */
export async function checkDueCareAndSendNotifications(targetUserId = null) {
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
    const samplePlants = userTasks
      .slice(0, 3)
      .map((t) => `${t.plantName} (${t.taskLabel.toLowerCase()})`)
      .join(", ");
    const andMore = taskCount > 3 ? ` i ${taskCount - 3} więcej` : "";

    const notificationPayload = {
      title: "🌱 Greenly: Czas na pielęgnację!",
      body: `Dzisiaj czeka na Ciebie ${taskCount} ${
        taskCount === 1 ? "zadanie" : taskCount < 5 ? "zadania" : "zadań"
      }: ${samplePlants}${andMore}.`,
      icon: "/icon-192.png",
      badge: "/favicon.svg",
      tag: `greenly-care-${new Date().toISOString().slice(0, 10)}`,
      data: {
        url: "/schedules",
        taskCount,
      },
    };

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
  sendNotificationToUser,
  sendNotificationToSubscription,
  checkDueCareAndSendNotifications,
};
