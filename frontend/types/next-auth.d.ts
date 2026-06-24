import { DefaultSession } from "next-auth";

/**
 * Augments the next-auth session and user types to include
 * the wallet address from SIWE (Sign-In with Ethereum).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      address: string;
    } & DefaultSession["user"];
  }

  interface User {
    /** The Ethereum wallet address derived from SIWE. */
    address?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** The Ethereum wallet address persisted in the JWT. */
    address?: string;
  }
}
