import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get the current session from Better Auth in an API route handler.
 *
 * Usage:
 *   const session = await getServerSession();
 *   if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *   const walletAddress = session.user.id; // user.id = wallet address for SIWE
 */
export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Require authentication or return 401.
 * Returns the session if the user is authenticated.
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new AuthError("Unauthorized");
  }
  return session;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
