import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { accessCodeMatches } from "@/lib/access-code";
import { SIGNUP_CODE_HEADER } from "@/lib/signup-code-header";

export const auth = betterAuth({
  appName: "The Handover",
  // pg connects lazily, so importing this at build time needs no database.
  database: new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
  // Locally BETTER_AUTH_URL pins the origin. On Netlify it's left unset and the
  // request host is checked instead, which covers production, deploy previews
  // (deploy-preview-N--handingover) and branch deploys with one config.
  baseURL: process.env.BETTER_AUTH_URL ?? {
    allowedHosts: ["handingover.netlify.app", "*--handingover.netlify.app"],
    protocol: "https",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // input: false keeps this out of the sign-up body. Without it, anyone
      // could make themselves an admin by adding a field to the request.
      role: { type: "string", required: false, input: false, defaultValue: "user" },
    },
    // Deleting is permanent and immediate: everything hangs off records, which
    // cascades from "user". There's no email provider to confirm through, so
    // the current password is the confirmation.
    deleteUser: { enabled: true },
  },
  // In-memory counters reset on every serverless cold start.
  rateLimit: { storage: "database" },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const given = ctx.headers?.get(SIGNUP_CODE_HEADER);
      if (!accessCodeMatches(given, process.env.SIGNUP_ACCESS_CODE)) {
        // 400 rather than 403: Netlify's local server replaces a function's 403
        // with an empty 404, losing the message the form shows.
        throw new APIError("BAD_REQUEST", {
          message: "That access code isn't right. Check it with whoever invited you.",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
