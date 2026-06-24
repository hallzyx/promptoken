import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth catch-all route handler.
 *
 * Handles all auth endpoints: sign-in, sign-out, session, SIWE nonce/verify.
 * Using toNextJsHandler() ensures compatibility with Next.js 16 + Turbopack.
 */
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
