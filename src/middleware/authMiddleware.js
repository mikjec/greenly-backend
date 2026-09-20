import { prisma } from "../config/prisma.js";
import { verifyAuthToken } from "../utils/jwt.js";
import { authCookieName } from "../utils/cookie.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[authCookieName];

  if (!token) {
    res.status(401);
    throw new Error("Brak autoryzacji");
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    res.status(401);
    throw new Error("Nieprawidłowy lub wygasły token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    res.status(401);
    throw new Error("Użytkownik nie istnieje");
  }

  req.user = user;
  next();
});
