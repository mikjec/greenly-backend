import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { getWeatherData } from "../services/weatherService.js";
import { wateringDemo } from "../services/wateringOptimization.js";
import { db } from "../db/index.js";
import { listOptimizationHistory } from "../services/optimizationHistory.js";

const router = Router();
router.use(requireAuth);
router.get("/optimization-history", async (req, res) => {
  try {
    res.json(await listOptimizationHistory(db, req.user.id, req.query.before));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : "Nie udało się pobrać historii optymalizacji." });
  }
});
router.get("/optimization-demo", (req, res) => res.json(wateringDemo()));
router.get("/", async (req, res) => {
  try {
    res.json({ weather: await getWeatherData(req.query.location) });
  } catch (error) {
    res.status(error.status || 502).json({ message: error.message });
  }
});
export default router;
