import axios from "axios";

const BASE_URL = "http://localhost:3000/api";

async function runTests() {
  console.log("🚀 Rozpoczynam kompleksowy test API Greenly...\n");

  try {
    // 1. Healthcheck
    const health = await axios.get(`${BASE_URL}/health`);
    console.log("✅ 1. Healthcheck:", health.data);

    // 2. Rejestracja unikalnego użytkownika
    const randomEmail = `gardener_${Date.now()}@greenly.test`;
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: randomEmail,
      password: "securePassword123!",
    });
    console.log("✅ 2. Rejestracja użytkownika:", regRes.data.user.email);
    const token = regRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. Logowanie
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: randomEmail,
      password: "securePassword123!",
    });
    console.log("✅ 3. Logowanie użytkownika:", loginRes.data.user.email);

    // 4. Profil /me
    const meRes = await axios.get(`${BASE_URL}/auth/me`, { headers: authHeaders });
    console.log("✅ 4. Autoryzacja i profil użytkownika:", meRes.data.user.email);

    // 5. Utworzenie mikroklimatu Outdoor
    const microclimateRes = await axios.post(
      `${BASE_URL}/microclimates`,
      {
        name: "Taras Południowy",
        environmentType: "Outdoor",
        weatherSource: "open-meteo",
        location: "Kraków",
        temperature: 24.0,
        humidity: 60.0,
        lightLevel: "direct_sun",
      },
      { headers: authHeaders }
    );
    const microclimate = microclimateRes.data.microclimate;
    console.log("✅ 5. Utworzenie mikroklimatu:", microclimate.name, `(ID: ${microclimate.id})`);

    // 6. Pobranie mikroklimatów
    const listMicro = await axios.get(`${BASE_URL}/microclimates`, { headers: authHeaders });
    console.log(`✅ 6. Pobranie mikroklimatów (znaleziono: ${listMicro.data.microclimates.length})`);

    // 7. Dodanie rośliny
    const plantRes = await axios.post(
      `${BASE_URL}/plants`,
      {
        microclimateId: microclimate.id,
        nickname: "Pomidor Koktajlowy 'Koralik'",
        externalSpeciesId: "solanum-lycopersicum",
        locationDescription: "Duża donica na tarasie",
        frequencyDays: 2,
        imageUrl: "https://images.unsplash.com/photo-1592841200221-a6898f307baa",
      },
      { headers: authHeaders }
    );
    const plant = plantRes.data.plant;
    console.log("✅ 7. Dodanie rośliny:", plant.nickname, `(ID: ${plant.id})`);
    console.log("   Harmonogram podlewania:", plant.schedules[0]);

    // 8. Pobranie szczegółów rośliny
    const plantDetailRes = await axios.get(`${BASE_URL}/plants/${plant.id}`, { headers: authHeaders });
    console.log("✅ 8. Szczegóły rośliny pobrane z relacjami:", plantDetailRes.data.plant.nickname);

    // 9. Zalogowanie czynności pielęgnacyjnej (podlewanie)
    const careRes = await axios.post(
      `${BASE_URL}/care/plants/${plant.id}`,
      {
        taskTypeKey: "water",
        notes: "Podlano obficie wodą odstaną z biohumusem",
      },
      { headers: authHeaders }
    );
    console.log("✅ 9. Logowanie czynności pielęgnacyjnej:");
    console.log("   Czynność:", careRes.data.careAction.taskType.label);
    console.log("   Nowy termin następnego podlania:", careRes.data.updatedSchedule.nextDueDate);

    // 10. Pobranie historii pielęgnacji
    const historyRes = await axios.get(`${BASE_URL}/care/plants/${plant.id}`, { headers: authHeaders });
    console.log(`✅ 10. Historia pielęgnacji rośliny (wpisów: ${historyRes.data.history.length})`);

    // 11. Wywołanie zadania automatyzacji i pogody (CRON)
    console.log("✅ 11. Wywołanie zadania pogodowego CRON...");
    const cronRes = await axios.post(`${BASE_URL}/cron/trigger-weather`);
    console.log("   Wynik:", cronRes.data.message);

    // 12. Aktualizacja rośliny
    const updateRes = await axios.put(
      `${BASE_URL}/plants/${plant.id}`,
      {
        nickname: "Pomidor Koktajlowy 'Koralik' (Kwitnący)",
        locationDescription: "Przestawiony pod zadaszenie tarasu",
      },
      { headers: authHeaders }
    );
    console.log("✅ 12. Aktualizacja rośliny:", updateRes.data.plant.nickname);

    // 13. Usunięcie / archiwizacja rośliny
    const delRes = await axios.delete(`${BASE_URL}/plants/${plant.id}`, { headers: authHeaders });
    console.log("✅ 13. Usunięcie / archiwizacja rośliny:", delRes.data.message);

    console.log("\n🎉 Wszystkie testy integracyjne zakończone 100% SUKCESEM!");
  } catch (error) {
    console.error("❌ Błąd podczas testu:", error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
