import { createMiddleware } from "hono/factory";
import { type Auth, createAuth } from "../../../infrastructure/auth/better-auth";
import type { RequestContext } from "../../../shared/context";

/** Presentation-only profile of the signed-in user (for the app shell avatar). */
export type SessionUser = {
  name: string | null;
  email: string | null;
  image: string | null;
};

export type AuthVariables = {
  auth: Auth;
  ctx: RequestContext;
  me: SessionUser;
};

export type AuthEnv = { Bindings: Env; Variables: AuthVariables };

/** Build the Better Auth instance exactly once per request (avoids 503/waitUntil contention). */
export const withAuth = createMiddleware<AuthEnv>(async (c, next) => {
  c.set("auth", createAuth(c.env));
  await next();
});

/** Guard protected routes: require a valid session, then populate the tenant-scoped context. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("ctx", { userId: session.user.id });
  c.set("me", {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  });
  await next();
});
