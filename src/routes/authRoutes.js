import { Router } from "express";
import { register, login, getMe, updateProfile, deleteAccount } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.put("/profile", requireAuth, updateProfile);
router.put("/me", requireAuth, updateProfile);
router.delete("/account", requireAuth, deleteAccount);
router.delete("/me", requireAuth, deleteAccount);

export default router;
