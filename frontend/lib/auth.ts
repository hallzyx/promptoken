import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SiweMessage } from "siwe";

/**
 * NextAuth v5 configuration with SIWE (Sign-In with Ethereum).
 *
 * The actual API route handler (/api/auth/[...nextauth]) will be added
 * in Phase 2. This config provides the shared auth instance used by
 * client components and server actions.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "SIWE",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      authorize: async (credentials) => {
        try {
          const siwe = new SiweMessage(
            JSON.parse(credentials.message as string),
          );
          const result = await siwe.verify({
            signature: credentials.signature as string,
          });
          if (result.success) {
            return { id: siwe.address, address: siwe.address };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt" },
});
