import { Router } from "express";
import {
  createPlant,
  deletePlant,
  getDashboard,
  getPlantById,
  getPlants,
  updatePlant,
} from "../controllers/plantController.js";
import { getCareHistory, logCareAction } from "../controllers/careController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/dashboard", getDashboard);
router.get("/", getPlants);
router.post("/", createPlant);
router.get("/:id", getPlantById);
router.patch("/:id", updatePlant);
router.delete("/:id", deletePlant);
router.get("/:plantId/care-history", getCareHistory);
router.post("/:plantId/care-actions", logCareAction);

export default router;
