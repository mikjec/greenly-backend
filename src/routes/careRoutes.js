import { Router } from "express";
import {
  logCareAction,
  getCareHistory,
  getTaskTypes,
} from "../controllers/careController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/task-types", getTaskTypes);
router.post("/plants/:plantId", logCareAction);
router.get("/plants/:plantId", getCareHistory);
router.post("/", logCareAction);

export default router;
