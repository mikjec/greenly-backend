import { Router } from "express";
import { getCatalogPlantById, getCatalogPlants } from "../controllers/catalogController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getCatalogPlants);
router.get("/:id", getCatalogPlantById);

export default router;
