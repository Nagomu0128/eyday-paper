import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../../db/client";
import * as schema from "../../db/schema";

/**
 * Builds the Better Auth instance for a single request (D1-native via the
 * Drizzle adapter). Google is the only provider; client credentials come from
 * secrets. Google OIDC profile fields are persisted on the user row through
 * `additionalFields` + `mapProfileToUser` (stable identity = google `sub`).
 */
export const createAuth = (env: Env) =>
  betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }),
    user: {
      additionalFields: {
        googleSub: { type: "string", required: false, input: false },
        givenName: { type: "string", required: false, input: false },
        familyName: { type: "string", required: false, input: false },
        locale: { type: "string", required: false, input: false },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"],
        mapProfileToUser: (profile) => ({
          googleSub: profile.sub,
          givenName: profile.given_name,
          familyName: profile.family_name,
          locale: profile.locale,
          image: profile.picture,
        }),
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;
