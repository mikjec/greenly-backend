import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import authRoutes from "../../src/routes/authRoutes.js";
import { db, pool } from "../../src/db/index.js";
import { uruchomApi, wynikiZapytania } from "../helpers/http.js";

after(() => pool.end());
const haslo = "TestoweHaslo123!";

describe("Logowanie i dostęp do profilu", () => {
  test("logowanie i pobranie profilu przez prawdziwy JWT", async (t) => {
    const api = await uruchomApi(t, [["/auth", authRoutes]]);
    const user = { id: 17, email: "ala@example.com", passwordHash: await bcrypt.hash(haslo, 4) };
    t.mock.method(db, "select", (fields) => {
      const query = wynikiZapytania([fields ? { id: user.id, email: user.email } : user]);
      query.where = function (filter) {
        assert.deepEqual(new MySqlDialect().sqlToQuery(filter).params, [fields ? 17 : "ala@example.com"]);
        return this;
      };
      return query;
    });
    const login = await api("/auth/login", { method: "POST", body: { email: " ALA@example.com ", password: haslo } });
    assert.equal(login.status, 200);
    const profil = await api("/auth/me", { token: login.body.token });
    assert.equal(profil.status, 200);
    assert.equal(profil.body.user.id, 17);
    assert.equal(profil.body.user.passwordHash, undefined);
  });
});
