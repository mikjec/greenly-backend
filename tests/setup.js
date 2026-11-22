// Uruchamiane przed importem aplikacji: testy nie korzystają z danych ani kluczy z .env.
process.env.NODE_ENV = "test";
process.env.TZ = "Europe/Warsaw";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/greenly_test";
process.env.JWT_SECRET = "greenly-wylacznie-do-testow-jednostkowych";
process.env.JWT_EXPIRES_IN = "1h";
process.env.RESEND_API_KEY = "";
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.PLANTS_API = "";

// Klucze są generowane lokalnie, wyłącznie na potrzeby testu konfiguracji PUSH.
const { generateVAPIDKeys } = await import("web-push");
const keys = generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
