import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import microclimateRoutes from "./routes/microclimateRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";
import careRoutes from "./routes/careRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import { requireAuth } from "./middlewares/authMiddleware.js";
import {
  initCronJobs,
  checkOutdoorPlantsAndAdjustSchedules,
} from "./services/cronService.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguracja CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Konfiguracja middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Opcjonalny endpoint do ręcznego wywołania zadania cron (ułatwia testowanie i demonstrację)
app.post("/api/cron/trigger-weather", requireAuth, async (req, res) => {
  try {
    const result = await checkOutdoorPlantsAndAdjustSchedules(req.user.id);
    res
      .status(200)
      .json({ ...result, message: `Sprawdzono: ${result.checked}. Zmieniono: ${result.updated}. Pominięto z powodu błędu: ${result.skipped}.` });
  } catch (err) {
    res.status(500).json({
      message: "Błąd podczas wykonywania zadania pogodowego",
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
