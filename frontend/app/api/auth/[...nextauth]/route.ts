import { handlers } from "@/lib/auth";

/**
 * Route handler for next-auth v5 catch-all.
 * Handles sign-in, sign-out, session, and callback requests.
 */
export const runtime = "nodejs";

export const GET = handlers.GET;
export const POST = handlers.POST;
