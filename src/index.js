import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import microclimateRoutes from "./routes/microclimateRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";
import careRoutes from "./routes/careRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { uploadDirectory } from "./services/imageService.js";
import { requireAuth } from "./middlewares/authMiddleware.js";
import {
  initCronJobs,
  checkOutdoorPlantsAndAdjustSchedules,
} from "./services/cronService.js";
import { checkDueCareAndSendNotifications } from "./services/notificationService.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguracja CORS
const configuredClients = (process.env.CLIENT_URL || "")
  .split(",")
  .map((u) => {
    let clean = u.trim().replace(/\/+$/, "");
    if (clean && !/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    return clean;
  })
  .filter(Boolean);

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const allowedOrigins = new Set([...defaultOrigins, ...configuredClients]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Zezwalaj na żądania bez origin (np. curl, testy, zapytania serwerowe)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.has(normalizedOrigin) ||
        normalizedOrigin.endsWith(".railway.app") ||
        normalizedOrigin.endsWith(".up.railway.app") ||
        normalizedOrigin.endsWith(".onrender.com") ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|87\.246\.\d+\.\d+)(:\d+)?$/.test(
          normalizedOrigin
        ) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }

      console.warn(`[CORS] Zablokowano żądanie z Origin: ${origin}`);
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Konfiguracja middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDirectory, { dotfiles: "deny", setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff") }));

// Podstawowy endpoint diagnostyczny
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    app: "Greenly Virtual Garden Backend",
    timestamp: new Date().toISOString(),
  });
});

// Podpięcie routerów biznesowych pod prefiks /api
app.use("/api/auth", authRoutes);
app.use("/api/microclimates", microclimateRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/care", careRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/notifications", notificationRoutes);

// Opcjonalny endpoint do ręcznego wywołania zadania cron (ułatwia testowanie i demonstrację)
app.post("/api/cron/trigger-weather", requireAuth, async (req, res) => {
  try {
    const result = await checkOutdoorPlantsAndAdjustSchedules(req.user.id);
    res
      .status(200)
      .json({ ...result, message: `Sprawdzono: ${result.checked}. Zmieniono: ${result.updated}. Pominięto: ${result.skipped}.` });
  } catch (err) {
    res.status(500).json({
      message: "Błąd podczas wykonywania zadania pogodowego",
      error: err.message,
    });
  }
});

// Endpoint wyzwalający wysyłkę powiadomień Push (np. z cron-job.org / GitHub Actions lub manualnie)
app.post("/api/cron/trigger-notifications", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers["x-cron-secret"] || req.query.secret;
    const authHeader = req.headers.authorization;

    // Jeśli skonfigurowano CRON_SECRET, wymagaj go w nagłówku/query lub autoryzacji tokenem
    if (cronSecret && providedSecret !== cronSecret && !authHeader) {
      return res.status(401).json({
        message: "Brak uprawnień do uruchomienia zadania cron (niepoprawny secret lub brak autoryzacji)",
      });
    }

    const result = await checkDueCareAndSendNotifications();
    res.status(200).json(result);
  } catch (err) {
    console.error("Błąd podczas wyzwalania powiadomień przez cron:", err);
    res.status(500).json({
      message: "Błąd podczas wyzwalania powiadomień push",
      error: err.message,
    });
  }
});

// Obsługa nieznalezionych tras 404
app.use((req, res) => {
  res.status(404).json({
    message: `Trasa ${req.method} ${req.originalUrl} nie została odnaleziona`,
  });
});

// Globalny handler błędów
app.use((err, req, res, next) => {
  console.error("Globalny błąd aplikacji:", err);
  res.status(err.status || 500).json({
    message: err.message || "Wewnętrzny błąd serwera",
  });
});

// Inicjalizacja harmonogramu zadań CRON
initCronJobs();

// Uruchomienie serwera HTTP
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🌱 Greenly Backend uruchomiony na porcie ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}/api`);
  console.log(`🩺 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});

export default app;
