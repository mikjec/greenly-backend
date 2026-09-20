# Greenly Backend

Backend dla projektu **Greenly** oparty na platformie Node.js, frameworku Express oraz Prisma ORM z bazą danych MySQL (Railway).

## 🚀 Technologie

- **Node.js**
- **Express** - framework serwera HTTP
- **Prisma ORM** - obsługa bazy danych MySQL
- **Dotenv** - zarządzanie zmiennymi środowiskowymi

## 📁 Struktura projektu

- `index.js` - główny punkt wejścia aplikacji i konfiguracja serwera Express
- `prisma/` - schemat bazy danych Prisma
- `.env` - zmienne środowiskowe (nieudostępniane w repozytorium)
- `.gitignore` - reguły ignorowania plików dla Git

## 🛠️ Uruchomienie

1. Zainstaluj zależności:
   ```bash
   npm install
   ```

2. Skonfiguruj zmienne środowiskowe w pliku `.env`:
   ```env
   DATABASE_URL="twoj_url_do_bazy_danych"
   ```

3. Wygeneruj klienta Prisma:
   ```bash
   npx prisma generate
   ```

4. Uruchom serwer deweloperski:
   ```bash
   node index.js
   ```

Domyślnie serwer uruchamia się na porcie `3000`. Testowy endpoint dostępny jest pod adresem: `http://localhost:3000/`.
