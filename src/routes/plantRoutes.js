import { Router } from "express";
import {
  getPlants,
  getPlantById,
  createPlant,
  updatePlant,
  deletePlant,
} from "../controllers/plantController.js";
import { logCareAction, getCareHistory } from "../controllers/careController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getPlants);
router.get("/:id", getPlantById);
router.post("/", createPlant);
router.put("/:id", updatePlant);
router.patch("/:id", updatePlant);
router.delete("/:id", deletePlant);

// Dodatkowe endpointy wygody pod /api/plants/:plantId/...
router.post("/:plantId/care-actions", logCareAction);
router.post("/:plantId/care", logCareAction);
router.get("/:plantId/care-history", getCareHistory);

export default router;
