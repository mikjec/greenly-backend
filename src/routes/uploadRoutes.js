import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { storeImage } from "../services/imageService.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});
router.post(
  "/",
  requireAuth,
  (req, res, next) => {
    upload.single("image")(req, res, (error) => {
      if (error)
        return res
          .status(400)
          .json({
            message: "Prześlij jeden plik zdjęcia o rozmiarze do 5 MB.",
          });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Wybierz zdjęcie." });
    const path = await storeImage(req.file.buffer, req.user.id);
    res.status(201).json({ imageUrl: path });
  },
);
export default router;
