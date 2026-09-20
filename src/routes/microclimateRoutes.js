import { Router } from "express";
import {
  getMicroclimates,
  getMicroclimateById,
  createMicroclimate,
  updateMicroclimate,
  deleteMicroclimate,
} from "../controllers/microclimateController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getMicroclimates);
router.get("/:id", getMicroclimateById);
router.post("/", createMicroclimate);
router.put("/:id", updateMicroclimate);
router.patch("/:id", updateMicroclimate);
router.delete("/:id", deleteMicroclimate);

export default router;
