require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const port = process.env.PORT || 3000;

let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.log('PrismaClient zainicjowany w trybie oczekiwania na adapter:', error.message);
}

app.use(express.json());

// Testowy endpoint GET /
app.get('/', (req, res) => {
  res.json({
    message: 'Greenly Backend działa poprawnie!',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Serwer Greenly Backend nasłuchuje na porcie ${port}`);
});

module.exports = { app, prisma };
