import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, sendWelcomeEmail } from "../src/services/emailService.js";

test("sendEmail skips gracefully when RESEND_API_KEY is missing", async () => {
  const result = await sendEmail(
    { to: "user@example.com", subject: "Test", html: "<p>Hi</p>", text: "Hi" },
    { apiKey: "" }
  );

  assert.deepEqual(result, { skipped: true });
});

test("sendWelcomeEmail sends expected payload via Resend client", async () => {
  const sentPayloads = [];
  const fakeClientFactory = (apiKey) => {
    assert.equal(apiKey, "re_test_key");
    return {
      emails: {
        send: async (payload) => {
          sentPayloads.push(payload);
          return { data: { id: "email_123" }, error: null };
        },
      },
    };
  };

  const result = await sendWelcomeEmail("nowy@example.com", {
    apiKey: "re_test_key",
    from: "Greenly <noreply@greenly.test>",
    clientFactory: fakeClientFactory,
  });

  assert.equal(result.skipped, false);
  assert.equal(result.data.id, "email_123");
  assert.equal(sentPayloads.length, 1);
  assert.equal(sentPayloads[0].to, "nowy@example.com");
  assert.equal(sentPayloads[0].from, "Greenly <noreply@greenly.test>");
  assert.match(sentPayloads[0].subject, /Witaj w Greenly/i);
  assert.match(sentPayloads[0].html, /Witaj w Greenly/i);
});

test("sendWelcomeEmail throws when Resend returns an error", async () => {
  const fakeClientFactory = () => ({
    emails: {
      send: async () => ({ data: null, error: { message: "Domain not verified" } }),
    },
  });

  await assert.rejects(
    () =>
      sendWelcomeEmail("nowy@example.com", {
        apiKey: "re_test_key",
        clientFactory: fakeClientFactory,
      }),
    /Domain not verified/
  );
});
