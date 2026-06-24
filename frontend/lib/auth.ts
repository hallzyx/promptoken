import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SiweMessage } from "siwe";

/**
 * NextAuth v5 configuration with SIWE (Sign-In with Ethereum).
 *
 * The credentials provider verifies an EIP-4361 signed message (SIWE).
 * On success, the wallet address is stored in both the JWT and session
 * so downstream API routes can identify the authenticated user.
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
            return {
              id: siwe.address,
              name: siwe.address,
              address: siwe.address,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    /**
     * Persist the wallet address from the authorize step into the JWT
     * so it survives across session refreshes.
     */
    jwt({ token, user }) {
      if (user?.address) {
        token.address = user.address;
      }
      return token;
    },
    /**
     * Expose the wallet address and user id in every server / client
     * session object.
     */
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.address) session.user.address = token.address as string;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt" },
});
