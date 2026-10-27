import { APIError, createAuthMiddleware } from "better-auth/api";
import { testerMode, testerEmailAllowed } from "./auth-policy";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { queueEmail, flushOutbox } from "./mail";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !testerEmailAllowed(ctx.body?.email)) {
        throw new APIError("FORBIDDEN", { message: "Signup is restricted to invited testers." });
      }
      if (testerMode && ["/request-password-reset", "/send-verification-email"].includes(ctx.path)) {
        throw new APIError("FORBIDDEN", { message: "Email delivery is unavailable during tester access." });
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      await queueEmail(
        user.email,
        "Reset your Mehlivo password",
        url,
        `reset:${token}`,
      );
      await flushOutbox();
    },
  },
  emailVerification: {
    sendOnSignUp: !testerMode,
    sendVerificationEmail: async ({ user, url, token }) => {
      await queueEmail(
        user.email,
        "Verify your Mehlivo email",
        url,
        `verify:${token}`,
      );
      await flushOutbox();
    },
  },
  rateLimit: { enabled: true, storage: "memory", window: 60, max: 30 },
});
