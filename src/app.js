import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";

import authRoutes from "./routes/authRoutes.js";
import microclimateRoutes from "./routes/microclimateRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ message: "Greenly API działa poprawnie" });
});

app.use("/api/auth", authRoutes);
app.use("/api/microclimates", microclimateRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/schedules", scheduleRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
