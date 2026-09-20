# Specyfikacja Techniczna i Dokumentacja API – Greenly Backend

Niniejszy dokument stanowi pełną specyfikację techniczną interfejsu programistycznego (REST API) dla platformy **Greenly**.

---

## 1. Konwencje i Standardy

- **Bazowy adres API:** `http://localhost:3000/api`
- **Format danych:** Wszystkie żądania wysyłające dane w ciele (request body) muszą posiadać nagłówek `Content-Type: application/json`.
- **Kodowanie:** UTF-8.
- **Uwierzytelnianie:** Standard RFC 6750 (Bearer Token).
  ```http
  Authorization: Bearer <TOKEN_JWT>
  ```
- **Obsługa błędów:** W przypadku wystąpienia błędu serwer zwraca odpowiedni kod HTTP oraz obiekt JSON:
  ```json
  {
    "message": "Opis błędu w języku polskim",
    "error": "Opcjonalny techniczny szczegół błędu"
  }
  ```

### Standardowe Kody Odpowiedzi HTTP:
- `200 OK` – Pomyślne wykonanie operacji odczytu, aktualizacji lub usunięcia.
- `201 Created` – Pomyślne utworzenie nowego zasobu (np. użytkownika, rośliny, mikroklimatu, zabiegu).
- `400 Bad Request` – Brak wymaganych pól lub niepoprawny format danych (np. niepoprawny e-mail, hasło poniżej 6 znaków).
- `401 Unauthorized` – Brak tokena, token nieprawidłowy lub wygasły.
- `404 Not Found` – Żądany zasób nie istnieje lub nie należy do zalogowanego użytkownika.
- `409 Conflict` – Konflikt unikalności (np. próba rejestracji na istniejący adres e-mail).
- `500 Internal Server Error` – Niespodziewany błąd po stronie serwera / bazy danych.

---

## 2. Moduł Uwierzytelniania (`/api/auth`)

### 2.1 Rejestracja użytkownika
- **Metoda:** `POST`
- **Ścieżka:** `/api/auth/register`
- **Dostęp:** Publiczny
- **Ciało żądania:**
  ```json
  {
    "email": "user@example.com",     // string, wymagany, poprawny format e-mail
    "password": "secretPassword123"  // string, wymagany, min. 6 znaków
  }
  ```
- **Odpowiedź (201 Created):**
  ```json
  {
    "message": "Użytkownik zarejestrowany pomyślnie",
    "token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "email": "user@example.com"
    }
  }
  ```

### 2.2 Logowanie użytkownika
- **Metoda:** `POST`
- **Ścieżka:** `/api/auth/login`
- **Dostęp:** Publiczny
- **Ciało żądania:**
  ```json
  {
    "email": "user@example.com",
    "password": "secretPassword123"
  }
  ```
- **Odpowiedź (200 OK):**
  ```json
  {
    "message": "Zalogowano pomyślnie",
    "token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "createdAt": "2026-09-20T17:19:58.000Z"
    }
  }
  ```

### 2.3 Pobranie profilu zalogowanego użytkownika
- **Metoda:** `GET`
- **Ścieżka:** `/api/auth/me`
- **Dostęp:** Wymaga Bearer Token
- **Odpowiedź (200 OK):**
  ```json
  {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "createdAt": "2026-09-20T17:19:58.000Z"
    }
  }
  ```

---

## 3. Moduł Mikroklimatów (`/api/microclimates`)

Mikroklimaty definiują środowisko życia roślin (np. `Indoor`, `Outdoor`, `Greenhouse`, `Balcony`). 

### 3.1 Lista mikroklimatów
- **Metoda:** `GET`
- **Ścieżka:** `/api/microclimates`
- **Dostęp:** Wymaga Bearer Token
- **Odpowiedź (200 OK):**
  ```json
  {
    "microclimates": [
      {
        "id": 1,
        "userId": 1,
        "name": "Balkon Południowy",
        "environmentType": "Outdoor",
        "weatherSource": "open-meteo",
        "location": "Warszawa",
        "temperature": "22.50",
        "humidity": "55.00",
        "lightLevel": "high",
        "createdAt": "2026-09-20T17:20:09.000Z"
      }
    ]
  }
  ```

### 3.2 Utworzenie mikroklimatu
- **Metoda:** `POST`
- **Ścieżka:** `/api/microclimates`
- **Dostęp:** Wymaga Bearer Token
- **Ciało żądania:**
  ```json
  {
    "name": "Salon Okno",             // string, wymagany
    "environmentType": "Indoor",       // string, wymagany (np. Indoor, Outdoor)
    "weatherSource": null,             // string, opcjonalny
    "location": "Warszawa",            // string, opcjonalny
    "temperature": 21.5,               // number, opcjonalny
    "humidity": 45.0,                  // number, opcjonalny
    "lightLevel": "medium"             // string, opcjonalny
  }
  ```

### 3.3 Pobranie pojedynczego mikroklimatu
- **Metoda:** `GET`
- **Ścieżka:** `/api/microclimates/:id`
- **Dostęp:** Wymaga Bearer Token

### 3.4 Aktualizacja mikroklimatu
- **Metoda:** `PUT` / `PATCH`
- **Ścieżka:** `/api/microclimates/:id`
- **Dostęp:** Wymaga Bearer Token

### 3.5 Usunięcie mikroklimatu
- **Metoda:** `DELETE`
- **Ścieżka:** `/api/microclimates/:id`
- **Dostęp:** Wymaga Bearer Token

---

## 4. Moduł Roślin (`/api/plants`)

### 4.1 Pobranie roślin użytkownika
- **Metoda:** `GET`
- **Ścieżka:** `/api/plants`
- **Dostęp:** Wymaga Bearer Token
- **Opis:** Zwraca wszystkie aktywne (niezarchiwizowane) rośliny użytkownika. Każda roślina zawiera zagnieżdżone obiekty: `microclimate`, `images` oraz aktywne `schedules` wraz ze słownikiem `taskType`.

### 4.2 Pobranie szczegółów pojedynczej rośliny
- **Metoda:** `GET`
- **Ścieżka:** `/api/plants/:id`
- **Dostęp:** Wymaga Bearer Token
- **Opis:** Zwraca pełne dane rośliny, mikroklimat, listę zdjęć, wszystkie harmonogramy oraz pełną historię wykonanych zabiegów (`careHistory`) posortowaną malejąco według daty wykonania.

### 4.3 Dodanie rośliny
- **Metoda:** `POST`
- **Ścieżka:** `/api/plants`
- **Dostęp:** Wymaga Bearer Token
- **Ciało żądania:**
  ```json
  {
    "microclimateId": 1,                              // int, wymagany
    "nickname": "Paprotka Bostońska",                 // string, wymagany
    "externalSpeciesId": "nephrolepis-exaltata",      // string, opcjonalny
    "locationDescription": "Półka w cieniu",          // string, opcjonalny
    "frequencyDays": 4,                               // int, opcjonalny (domyślnie 7)
    "imageUrl": "https://example.com/image.jpg"       // string, opcjonalny
  }
  ```
- **Automatyczna logika:** Po utworzeniu rekordu w tabeli `plants`, system automatycznie wyszukuje podstawowy typ zabiegu `water` i generuje w tabeli `schedules` harmonogram z terminem `nextDueDate = now() + frequencyDays`. Jeśli podano `imageUrl`, dodawany jest wpis w `plant_images`.

### 4.4 Aktualizacja rośliny
- **Metoda:** `PUT` / `PATCH`
- **Ścieżka:** `/api/plants/:id`
- **Dostęp:** Wymaga Bearer Token

### 4.5 Usunięcie rośliny
- **Metoda:** `DELETE`
- **Ścieżka:** `/api/plants/:id`
- **Dostęp:** Wymaga Bearer Token
- **Parametry zapytania (Query):**
  - `?permanent=true` – Trwałe usunięcie rekordu z bazy danych wraz z powiązanymi danymi kaskadowymi.
  - Domyślnie – Archiwizacja (*soft-delete*): ustawia `active = false`, `archivedAt = now()` oraz dezaktywuje harmonogramy (`schedules.active = false`).

---

## 5. Moduł Pielęgnacji (`/api/care`)

Moduł odpowiada za rejestrowanie wykonanych czynności i powiązaną automatyzację harmonogramów.

### 5.1 Słownik typów zabiegów
- **Metoda:** `GET`
- **Ścieżka:** `/api/care/task-types`
- **Dostęp:** Wymaga Bearer Token
- **Odpowiedź:**
  ```json
  {
    "taskTypes": [
      { "id": 1, "key": "water", "label": "Podlewanie" },
      { "id": 2, "key": "fertilize", "label": "Nawożenie" },
      { "id": 3, "key": "repot", "label": "Przesadzanie" },
      { "id": 4, "key": "prune", "label": "Przycinanie" }
    ]
  }
  ```

### 5.2 Zalogowanie wykonanej czynności pielęgnacyjnej
- **Metoda:** `POST`
- **Ścieżka:** `/api/care/plants/:plantId` (alias: `/api/plants/:plantId/care-actions`)
- **Dostęp:** Wymaga Bearer Token
- **Ciało żądania:**
  ```json
  {
    "taskTypeKey": "water",                      // string (lub taskTypeId: int)
    "completedAt": "2026-09-20T17:30:00.000Z",   // string ISO, opcjonalny (domyślnie now)
    "notes": "Podlano miękką wodą"               // string, opcjonalny
  }
  ```
- **Automatyczna logika biznesowa:**
  1. Weryfikuje uprawnienia użytkownika do danej rośliny.
  2. Zapisuje wpis w tabeli `care_history`.
  3. Odnajduje aktywny harmonogram w tabeli `schedules` dla pary `(plantId, taskTypeId)`.
  4. Uaktualnia `schedules.lastCompletedAt = completedAt`.
  5. Oblicza nowy termin `schedules.nextDueDate = completedAt + frequencyDays`.

### 5.3 Pobranie historii zabiegów dla rośliny
- **Metoda:** `GET`
- **Ścieżka:** `/api/care/plants/:plantId` (alias: `/api/plants/:plantId/care-history`)
- **Dostęp:** Wymaga Bearer Token

---

## 6. Automatyzacja Pogodowa (CRON Service)

Usługa [**`src/services/cronService.js`**](file:///D:/Greenly/greenly-backend/src/services/cronService.js) odpowiada za analizę warunków atmosferycznych i dynamiczną korektę planów podlewania.

- **Harmonogram:** `0 8 * * *` (codziennie o godzinie 08:00 rano).
- **Zakres:** Rośliny w mikroklimatach o `environment_type = 'Outdoor'`.
- **Algorytm:**
  - Jeśli stacja pogodowa melduje opady deszczu: termin kolejnego podlewania w `schedules` zostaje przesunięty o **2 dni w przód**.
  - Jeśli temperatura wynosi >= 28°C i brak opadów: termin kolejnego podlewania zostaje przyspieszony o **1 dzień**.
  - W konsoli serwera emitowane jest powiadomienie **PUSH** przypisane do adresu e-mail i ID właściciela rośliny.

### Ręczne wywołanie diagnostyczne:
- **Metoda:** `POST`
- **Ścieżka:** `/api/cron/trigger-weather`
- **Dostęp:** Publiczny (wewnętrzny/diagnostyczny)
