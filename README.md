# 🌱 Greenly Backend

REST API dla platformy **Greenly** – inteligentnego asystenta wirtualnego ogrodu, harmonogramowania pielęgnacji roślin oraz adaptacji podlewania na podstawie warunków pogodowych i mikroklimatu.

---

## 📋 Spis treści
- [Technologie](#-technologie)
- [Główne funkcjonalności](#-główne-funkcjonalności)
- [Architektura projektu](#-architektura-projektu)
- [Wymagania i zmienne środowiskowe](#-wymagania-i-zmienne-środowiskowe)
- [Instalacja i uruchomienie lokalne](#-instalacja-i-uruchomienie-lokalne)
- [Baza danych i migracje](#-baza-danych-i-migracje)
- [Automatyzacja pogodowa (CRON & Algorytmy)](#-automatyzacja-pogodowa-cron--algorytmy)
- [Przegląd endpointów API](#-przegląd-endpointów-api)
- [Wdrożenie na Railway](#-wdrożenie-na-railway)

---

## 🛠 Technologie

- **Środowisko:** Node.js (ES Modules)
- **Framework:** Express.js 5
- **Baza danych:** MySQL 8
- **ORM:** Drizzle ORM (`drizzle-orm/mysql2`, `drizzle-kit`)
- **Autoryzacja:** JSON Web Tokens (`jsonwebtoken`), haszowanie haseł `bcrypt`
- **Zadania cykliczne:** `node-cron`
- **Przetwarzanie obrazów:** `multer`, `sharp` (automatyczna konwersja do formatu WebP)
- **Zewnętrzne API:** 
  - Open-Meteo (dane pogodowe)
  - Perenual API (katalog gatunków roślin)
- **Testy:** Natywny runner testów Node.js (`node --test`)

---

## 🚀 Główne funkcjonalności

1. **Zarządzanie kontem i autoryzacja:**
   - Rejestracja z walidacją adresu e-mail i siły hasła.
   - Logowanie z generowaniem tokenów JWT (czas trwania: 7 dni).
   - Middleware `requireAuth` weryfikujący tożsamość i uprawnienia użytkownika.

2. **Strefy mikroklimatyczne (Microclimates):**
   - Podział roślin na strefy: wewnętrzne (**Indoor**) oraz zewnętrzne (**Outdoor**).
   - Definiowanie lokalizacji geograficznej (potrzebnej do prognozy pogody).
   - Rejestracja parametrów otoczenia: temperatura (°C), wilgotność (%), nasłonecznienie.

3. **Wirtualny ogród i rośliny (Plants):**
   - Dodawanie i edycja roślin, przypisywanie do mikroklimatów.
   - Opcjonalne powiązanie z gatunkiem z katalogu Perenual.
   - Obsługa wgrywania zdjęć roślin z optymalizacją do WebP.
   - Archiwizacja i miękkie/twarde usuwanie.

4. **Harmonogramy i historia pielęgnacji (Care & Schedules):**
   - Domyślne typy zadań: podlewanie (*water*), nawożenie (*fertilize*), przesadzanie (*repot*), przycinanie (*prune*).
   - Automatyczne wyznaczanie kolejnego terminu pielęgnacji (`nextDueDate`) po odznaczeniu wykonanego zadania.
   - Pełna historia zabiegów pielęgnacyjnych wraz z notatkami użytkownika.

5. **Inteligentny silnik pogodowy (Weather Adaptation):**
   - **Rośliny zewnętrzne:** Codzienny CRON o 8:00 analizuje prognozy opadów i temperatur dla lokalizacji mikroklimatu. W przypadku prognozowanego deszczu (≥ 2 mm) podlewanie zostaje odroczone; w przypadku upałów (≥ 28°C) termin może zostać przyspieszony.
   - **Rośliny wewnętrzne:** Dynamiczna korekta częstotliwości podlewania w oparciu o temperaturę i wilgotność w pokoju.

6. **Integracja z katalogiem Perenual:**
   - Wyszukiwanie gatunków, stronicowanie i filtry zapotrzebowania na wodę.
   - Wbudowany mechanizm pamięci podręcznej (in-memory request cache), zapobiegający wyczerpywaniu limitów darmowego API.

---

## 📁 Architektura projektu

```text
greenly-backend/
├── drizzle/                  # Wygenerowane pliki migracji SQL
├── drizzle.config.js         # Konfiguracja Drizzle ORM i Drizzle Kit
├── package.json              # Zależności i skrypty npm
├── src/
│   ├── index.js              # Główny punkt startowy aplikacji Express i middleware CORS
│   ├── controllers/          # Kontrolery HTTP (logika żądań/odpowiedzi)
│   │   ├── authController.js
│   │   ├── careController.js
│   │   ├── microclimateController.js
│   │   └── plantController.js
│   ├── db/                   # Konfiguracja bazy danych
│   │   ├── index.js          # Pula połączeń mysql2 oraz instancja Drizzle ORM
│   │   ├── schema.js         # Schemat tabel MySQL (users, plants, schedules itd.)
│   │   └── seed.js           # Wstępne zasilenie bazy (typy zadań, dane demo)
│   ├── middlewares/          # Warstwy pośrednie (autoryzacja JWT)
│   │   └── authMiddleware.js
│   ├── routes/               # Definicje tras API
│   │   ├── authRoutes.js
│   │   ├── careRoutes.js
│   │   ├── catalogRoutes.js
│   │   ├── microclimateRoutes.js
│   │   ├── plantRoutes.js
│   │   ├── uploadRoutes.js
│   │   └── weatherRoutes.js
│   └── services/             # Usługi biznesowe i algorytmy
│       ├── catalogService.js # Klient API Perenual z cachem
│       ├── cronService.js    # Harmonogram zadań pogodowych
│       ├── imageService.js   # Konwersja i zapis zdjęć przez Sharp
│       ├── indoorPolicy.js   # Logika podlewania wewnątrz pomieszczeń
│       ├── microclimateValidation.js # Walidacja parametrów stref
│       ├── requestCache.js   # Pamięć podręczna zapytań
│       ├── wateringSuggestion.js # Rekomendacje częstotliwości nawadniania
│       └── weatherService.js # Integracja z Open-Meteo API
└── tests/                    # Testy jednostkowe i integracyjne
    ├── catalog.test.js
    ├── features.test.js
    ├── routes.test.js
    └── watering.test.js
```

---

## ⚙️ Wymagania i zmienne środowiskowe

Utwórz plik `.env` w katalogu głównym backendu:

```env
# Port serwera HTTP (domyślnie 3000)
PORT=3000

# Połączenie z bazą MySQL (obsługuje DATABASE_URL lub MYSQL_URL)
DATABASE_URL=mysql://uzytkownik:haslo@localhost:3306/greenly

# Adres frontendu dla polityki CORS (można podać kilka po przecinku)
CLIENT_URL=http://localhost:5173

# Klucz do podpisywania tokenów JWT
JWT_SECRET=twoj_bardzo_bezpieczny_klucz_jwt_2026
JWT_EXPIRES_IN=7d

# (Opcjonalnie) Klucz do Perenual API dla katalogu roślin
PLANTS_API=twoj_klucz_perenual_api
```

---

## 💻 Instalacja i uruchomienie lokalne

1. **Instalacja zależności:**
   ```bash
   npm install
   ```

2. **Inicjalizacja bazy danych (Drizzle Kit Push):**
   ```bash
   npm run db:push
   ```

3. **(Opcjonalnie) Zasilenie bazy danymi początkowymi:**
   ```bash
   node src/db/seed.js
   ```

4. **Uruchomienie serwera w trybie developerskim:**
   ```bash
   npm run dev
   ```

5. **Uruchomienie testów:**
   ```bash
   npm test
   ```

---

## 🗄 Baza danych i migracje

Baza danych zdefiniowana jest w pliku [`src/db/schema.js`](src/db/schema.js). Obejmuje relacje między 7 tabelami:
- **`users`** – konta użytkowników
- **`microclimates`** – strefy hodowli należące do użytkownika
- **`plants`** – rośliny przypisane do stref
- **`plant_images`** – zdjęcia przypisane do roślin
- **`task_types`** – słownik rodzajów pielęgnacji (`water`, `fertilize`, `repot`, `prune`)
- **`schedules`** – aktywne harmonogramy z interwałem dni i polem `nextDueDate`
- **`care_history`** – dziennik wykonanych prac pielęgnacyjnych

Do synchronizacji schematu ze strukturą bazy służy polecenie:
```bash
npm run db:push
```

---

## 🌦 Automatyzacja pogodowa (CRON & Algorytmy)

Backend uruchamia codzienne zadanie CRON (`0 8 * * * Europe/Warsaw`), które:
1. Pobiera aktywne rośliny i harmonogramy podlewania należące do stref **Outdoor**.
2. Odpytuje Open-Meteo o prognozę pogody dla lokalizacji mikroklimatu.
3. Jeśli prognozowane są opady deszczu powyżej 2 mm, termin podlewania przesuwany jest na za 2 dni.
4. Jeśli prognozowana temperatura przekracza 28°C, a opadów brak, jutrzejsze podlewanie jest przyspieszane na dzisiaj.
5. Dla stref **Indoor** weryfikowane są odchylenia temperatury i wilgotności od wartości referencyjnych.

Zadanie można również wywołać na żądanie (np. do testów lub demonstracji) endpointem:
`POST /api/cron/trigger-weather` (wymaga nagłówka `Authorization`).

---

## 📡 Przegląd endpointów API

Wszystkie trasy biznesowe udostępniane są pod prefiksem `/api`.

### Diagnostyka
| Metoda | Endpoint | Wymaga autoryzacji | Opis |
|---|---|:---:|---|
| `GET` | `/api/health` | Nie | Zwraca status działania backendu i timestamp |

### Autoryzacja (`/api/auth`)
| Metoda | Endpoint | Opis |
|---|---|---|
| `POST` | `/api/auth/register` | Rejestracja nowego użytkownika (`email`, `password`) |
| `POST` | `/api/auth/login` | Logowanie i zwrot tokenu JWT |
| `GET` | `/api/auth/me` | Pobranie profilu zalogowanego użytkownika |

### Mikroklimaty (`/api/microclimates`)
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/microclimates` | Lista stref zalogowanego użytkownika |
| `POST` | `/api/microclimates` | Utworzenie nowej strefy |
| `GET` | `/api/microclimates/:id` | Szczegóły danej strefy |
| `PUT` | `/api/microclimates/:id` | Aktualizacja strefy |
| `DELETE` | `/api/microclimates/:id` | Usunięcie strefy (wraz z roślinami – kaskada) |

### Rośliny (`/api/plants`)
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/plants` | Lista roślin użytkownika |
| `POST` | `/api/plants` | Dodanie rośliny i wygenerowanie harmonogramu |
| `GET` | `/api/plants/:id` | Szczegóły rośliny wraz ze strefą i terminami |
| `PUT` | `/api/plants/:id` | Edycja rośliny |
| `DELETE` | `/api/plants/:id` | Usunięcie rośliny |

### Pielęgnacja (`/api/care` oraz `/api/plants/:id/...`)
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/care/task-types` | Lista dostępnych typów czynności pielęgnacyjnych |
| `POST` | `/api/plants/:id/care-actions` | Zarejestrowanie wykonania zabiegu i aktualizacja terminu |
| `GET` | `/api/plants/:id/care-history` | Pobranie historii zabiegów dla danej rośliny |

### Zdjęcia (`/api/uploads`)
| Metoda | Endpoint | Opis |
|---|---|---|
| `POST` | `/api/uploads` | Przesłanie zdjęcia (multipart/form-data) z konwersją do WebP |

### Katalog i Pogoda
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/catalog` | Wyszukiwanie gatunków w bazie Perenual z filtrowaniem |
| `GET` | `/api/catalog/:id` | Szczegółowe wymagania wybranego gatunku |
| `GET` | `/api/weather?location=...` | Aktualne dane pogodowe dla podanej lokalizacji |

---

## ☁️ Wdrożenie na Railway

1. **Baza danych:** Dodaj w projekcie Railway plugin **MySQL**.
2. **Backend:** Połącz repozytorium `greenly-backend`.
3. **Zmienne środowiskowe w Railway:**
   - `DATABASE_URL`: `${{MySQL.MYSQL_URL}}`
   - `CLIENT_URL`: `https://twoj-frontend.up.railway.app` (koniecznie z `https://`)
   - `JWT_SECRET`: bezpieczny ciąg znaków
4. **Inicjalizacja tabel:**
   W konsoli Railway uruchom:
   ```bash
   npx drizzle-kit push
   ```
   lub ustaw w **Settings -> Deploy -> Pre-deploy Command**: `npx drizzle-kit push`.
