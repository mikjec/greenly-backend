import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { getWeatherData } from "../services/weatherService.js";

const router = Router();
router.use(requireAuth);
router.get("/", async (req, res) => {
  try { res.json({ weather: await getWeatherData(req.query.location) }); }
  catch (error) { res.status(error.status || 502).json({ message: error.message }); }
});
export default router;
