import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretgreenlyjwtkey_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Pola 'email' oraz 'password' są wymagane",
      });
    }

    const emailTrimmed = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({
        message: "Podaj prawidłowy adres e-mail",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Hasło musi zawierać co najmniej 6 znaków",
      });
    }

    // Sprawdź czy użytkownik już istnieje
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailTrimmed))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Użytkownik o podanym adresie e-mail już istnieje",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.insert(users).values({
      email: emailTrimmed,
      passwordHash,
    });

    const newUserId = result.insertId;

    const token = jwt.sign(
      { id: newUserId, email: emailTrimmed },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: "Użytkownik zarejestrowany pomyślnie",
      token,
      user: {
        id: newUserId,
        email: emailTrimmed,
      },
    });
  } catch (error) {
    console.error("Błąd podczas rejestracji:", error);
    return res.status(500).json({
      message: "Wystąpił błąd serwera podczas rejestracji",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Pola 'email' oraz 'password' są wymagane",
      });
    }

    const emailTrimmed = String(email).trim().toLowerCase();

    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, emailTrimmed))
      .limit(1);

    if (foundUsers.length === 0) {
      return res.status(401).json({
        message: "Nieprawidłowy e-mail lub hasło",
      });
    }

    const user = foundUsers[0];
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Nieprawidłowy e-mail lub hasło",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: "Zalogowano pomyślnie",
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Błąd podczas logowania:", error);
    return res.status(500).json({
      message: "Wystąpił błąd serwera podczas logowania",
      error: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      user: req.user,
    });
  } catch (error) {
    console.error("Błąd w getMe:", error);
    return res.status(500).json({
      message: "Wystąpił błąd podczas pobierania danych profilu",
      error: error.message,
    });
  }
};
