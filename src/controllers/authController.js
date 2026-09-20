import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signAuthToken } from "../utils/jwt.js";
import { authCookieName, getCookieOptions } from "../utils/cookie.js";

const registerSchema = z.object({
  email: z.string().trim().email("Podaj poprawny adres e-mail"),
  password: z.string().min(6, "Hasło powinno mieć co najmniej 6 znaków"),
});

const loginSchema = registerSchema;

const publicUserSelect = {
  id: true,
  email: true,
  createdAt: true,
};

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    res.status(409);
    throw new Error("Użytkownik o podanym adresie e-mail już istnieje");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
    },
    select: publicUserSelect,
  });

  const token = signAuthToken(user.id);
  res.cookie(authCookieName, token, getCookieOptions());

  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const userWithPassword = await prisma.user.findUnique({ where: { email: data.email } });
  if (!userWithPassword) {
    res.status(401);
    throw new Error("Nieprawidłowy e-mail lub hasło");
  }

  const isPasswordValid = await bcrypt.compare(data.password, userWithPassword.passwordHash);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Nieprawidłowy e-mail lub hasło");
  }

  const token = signAuthToken(userWithPassword.id);
  res.cookie(authCookieName, token, getCookieOptions());

  res.json({
    user: {
      id: userWithPassword.id,
      email: userWithPassword.email,
      createdAt: userWithPassword.createdAt,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(authCookieName, { ...getCookieOptions(), maxAge: undefined });
  res.json({ message: "Wylogowano użytkownika" });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
