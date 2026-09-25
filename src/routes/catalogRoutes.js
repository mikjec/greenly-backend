import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { listCatalog, catalogDetails } from "../services/catalogService.js";

const router = Router();
router.use(requireAuth);
// Return only sanitized errors; upstream request URLs contain the API key.
const handle = (handler) => async (req, res) => {
  try { await handler(req, res); }
  catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : "Błąd pobierania katalogu roślin." }); }
};
router.get("/", handle(listCatalog));
router.get("/:id", handle(catalogDetails));
export default router;
