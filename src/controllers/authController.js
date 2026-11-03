import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, ne, and } from "drizzle-orm";
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

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body || {};

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie został odnaleziony" });
    }

    const updates = {};
    let emailChanged = false;

    // Aktualizacja adresu e-mail
    if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const emailTrimmed = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return res.status(400).json({ message: "Podaj prawidłowy adres e-mail" });
      }

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, emailTrimmed), ne(users.id, userId)))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ message: "Podany adres e-mail jest już zajęty" });
      }

      updates.email = emailTrimmed;
      emailChanged = true;
    }

    // Aktualizacja hasła
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Podaj obecne hasło, aby ustawić nowe hasło" });
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return res.status(400).json({ message: "Obecne hasło jest niepoprawne" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Nowe hasło musi zawierać co najmniej 6 znaków" });
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({
        message: "Brak zmian do zapisania",
        user: { id: user.id, email: user.email, createdAt: user.createdAt },
      });
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    const updatedUser = {
      id: user.id,
      email: updates.email || user.email,
      createdAt: user.createdAt,
    };

    let newToken = null;
    if (emailChanged) {
      newToken = jwt.sign(
        { id: updatedUser.id, email: updatedUser.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
    }

    return res.status(200).json({
      message: "Dane profilu zostały pomyślnie zaktualizowane",
      user: updatedUser,
      token: newToken || undefined,
    });
  } catch (error) {
    console.error("Błąd podczas aktualizacji profilu:", error);
    return res.status(500).json({
      message: "Wystąpił błąd podczas aktualizacji profilu",
      error: error.message,
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body || {};

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie został odnaleziony" });
    }

    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Podane hasło jest niepoprawne" });
      }
    }

    // Usunięcie użytkownika kaskadowo usuwa powiązane dane
    await db.delete(users).where(eq(users.id, userId));

    return res.status(200).json({
      message: "Twoje konto oraz powiązane dane zostały bezpowrotnie usunięte",
    });
  } catch (error) {
    console.error("Błąd podczas usuwania konta:", error);
    return res.status(500).json({
      message: "Wystąpił błąd podczas usuwania konta",
      error: error.message,
    });
  }
};
