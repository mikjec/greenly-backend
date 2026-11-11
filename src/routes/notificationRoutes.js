import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendNotificationToUser,
} from "../services/notificationService.js";

const router = Router();

// Pobranie publicznego klucza VAPID (dostępne publicznie dla zarejestrowanych klientów)
router.get("/vapid-public-key", (req, res) => {
  const publicKey = getVapidPublicKey();
  res.json({ publicKey });
});

// Zapis subskrypcji dla zalogowanego użytkownika
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ message: "Brak obiektu subskrypcji" });
    }

    const id = await saveSubscription(req.user.id, subscription);
    res.status(201).json({
      message: "Subskrypcja powiadomień push została pomyślnie zapisana",
      id,
    });
  } catch (err) {
    console.error("Błąd zapisu subskrypcji push:", err);
    res.status(500).json({
      message: "Nie udało się zapisać subskrypcji powiadomień",
      error: err.message,
    });
  }
});

// Usunięcie subskrypcji (np. po cofnięciu zgody w profilu)
router.post("/unsubscribe", requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: "Brak parametru endpoint" });
    }

    await removeSubscription(endpoint);
    res.json({ message: "Subskrypcja została pomyślnie usunięta" });
  } catch (err) {
    console.error("Błąd usuwania subskrypcji:", err);
    res.status(500).json({
      message: "Błąd podczas usuwania subskrypcji",
      error: err.message,
    });
  }
});

// Natychmiastowe powiadomienie testowe na żądanie użytkownika
router.post("/test", requireAuth, async (req, res) => {
  try {
    const payload = {
      title: "🌱 Greenly: Test powiadomień!",
      body: "Gratulacje! Twoje urządzenie pomyślnie odbiera powiadomienia Push z Greenly.",
      icon: "/icon-192.png",
      badge: "/favicon.svg",
      tag: "greenly-test",
      data: { url: "/profile" },
    };

    const result = await sendNotificationToUser(req.user.id, payload);

    if (result.total === 0) {
      return res.status(400).json({
        message:
          "Brak zarejestrowanych urządzeń dla Twojego konta. Najpierw kliknij 'Włącz powiadomienia'.",
      });
    }

    res.json({
      message: `Wysłano powiadomienie testowe do ${result.sent} z ${result.total} urządzeń.`,
      result,
    });
  } catch (err) {
    console.error("Błąd wysyłania powiadomienia testowego:", err);
    res.status(500).json({
      message: "Nie udało się wysłać powiadomienia testowego",
      error: err.message,
    });
  }
});

export default router;
