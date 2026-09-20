import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma.js";

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Połączono z bazą danych przez Prisma");

    app.listen(PORT, () => {
      console.log(`Serwer Greenly działa na porcie ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Błąd uruchamiania serwera:", error);
    process.exit(1);
  }
};

startServer();
