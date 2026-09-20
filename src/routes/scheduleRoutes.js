import { Router } from "express";
import { getSchedules } from "../controllers/scheduleController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getSchedules);

export default router;
