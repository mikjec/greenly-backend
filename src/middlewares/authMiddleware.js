import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Brak tokenu autoryzacyjnego w nagłówku Authorization",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        message: "Nieprawidłowy format nagłówka Authorization",
      });
    }

    const secret = process.env.JWT_SECRET || "supersecretgreenlyjwtkey_2026";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        message: "Nieprawidłowy lub wygasły token autoryzacyjny",
      });
    }

    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Token nie zawiera identyfikatora użytkownika",
      });
    }

    const foundUsers = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (foundUsers.length === 0) {
      return res.status(401).json({
        message: "Użytkownik powiązany z tokenem nie istnieje",
      });
    }

    req.user = foundUsers[0];
    next();
  } catch (error) {
    console.error("Błąd w authMiddleware:", error);
    return res.status(500).json({
      message: "Błąd serwera podczas autoryzacji",
    });
  }
};

export default requireAuth;
