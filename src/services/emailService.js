import { Resend } from "resend";

const DEFAULT_FROM_EMAIL = "Greenly <onboarding@resend.dev>";

function createResendClient(apiKey) {
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Wysyła wiadomość e-mail przez Resend.
 * Gdy brakuje RESEND_API_KEY, pomija wysyłkę bez przerywania działania aplikacji.
 */
export async function sendEmail(
  { to, subject, html, text },
  {
    apiKey = process.env.RESEND_API_KEY?.trim(),
    from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL,
    clientFactory = createResendClient,
  } = {}
) {
  const client = clientFactory(apiKey);
  if (!client) {
    console.warn("[MAIL] Pominięto wysyłkę e-maila: brak zmiennej RESEND_API_KEY.");
    return { skipped: true };
  }

  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Nie udało się wysłać wiadomości e-mail przez Resend");
  }

  return { skipped: false, data };
}

/**
 * Wysyła powitalny e-mail do nowo zarejestrowanego użytkownika.
 */
export async function sendWelcomeEmail(toEmail, options = {}) {
  const appUrl =
    (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim() ||
    "http://localhost:5173";

  const subject = "Witaj w Greenly! 🌱 Twój wirtualny ogród jest gotowy";
  const text = [
    "Cześć!",
    "",
    "Dziękujemy za rejestrację w Greenly — Twoim asystencie do pielęgnacji roślin.",
    "Możesz już dodawać swoje rośliny, ustawiać mikroklimaty i korzystać z harmonogramów podlewania.",
    "",
    `Przejdź do aplikacji: ${appUrl}`,
    "",
    "Do zobaczenia w ogrodzie,",
    "Zespół Greenly",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #15803d; margin-bottom: 12px;">Witaj w Greenly! 🌱</h2>
      <p>Cześć!</p>
      <p>
        Dziękujemy za rejestrację w <strong>Greenly</strong> — Twoim wirtualnym ogrodzie.
        Twoje konto jest już aktywne i gotowe do działania.
      </p>
      <p>Możesz teraz:</p>
      <ul>
        <li>dodawać swoje rośliny z katalogu lub ręcznie,</li>
        <li>tworzyć mikroklimaty dopasowane do warunków w domu lub na zewnątrz,</li>
        <li>śledzić harmonogramy podlewania i otrzymywać przypomnienia.</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${appUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; display: inline-block; font-weight: bold;">
          Otwórz Greenly
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">
        Pozdrawiamy,<br />Zespół Greenly
      </p>
    </div>
  `.trim();

  return sendEmail(
    {
      to: toEmail,
      subject,
      html,
      text,
    },
    options
  );
}
