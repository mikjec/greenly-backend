import { Router } from "express";
import {
  createMicroclimate,
  deleteMicroclimate,
  getMicroclimates,
  updateMicroclimate,
} from "../controllers/microclimateController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getMicroclimates);
router.post("/", createMicroclimate);
router.patch("/:id", updateMicroclimate);
router.delete("/:id", deleteMicroclimate);

export default router;
