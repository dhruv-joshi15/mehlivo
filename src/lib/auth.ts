import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { queueEmail, flushOutbox } from "./mail";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
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
    sendOnSignUp: true,
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
