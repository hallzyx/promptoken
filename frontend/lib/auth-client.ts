import { createAuthClient } from "better-auth/react";
import { siweClient } from "better-auth/client/plugins";

/**
 * Typed Better Auth client for frontend use.
 *
 * Provides:
 * - signIn / signOut / useSession (standard auth)
 * - siwe.nonce() / siwe.verify() (wallet-based auth)
 *
 * @remarks The siweClient() plugin registration lets TypeScript infer
 * the `.siwe` methods on the client instance.
 */
export const authClient = createAuthClient({
  plugins: [siweClient()],
});
