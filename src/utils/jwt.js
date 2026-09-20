import jwt from "jsonwebtoken";

export const signAuthToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export const verifyAuthToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
