import { betterAuth } from "better-auth";
import { siwe } from "better-auth/plugins";
import { generateRandomString } from "better-auth/crypto";
import { verifyMessage } from "viem";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "33065"),
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "promptoken",
});

/**
 * Better Auth configuration with SIWE (Sign-In with Ethereum) plugin.
 *
 * Uses viem for signature verification — the same library used by wagmi
 * on the client side, ensuring consistent EIP-191 verification.
 */
export const auth = betterAuth({
  database: pool,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ],
  plugins: [
    siwe({
      domain: process.env.SIWE_DOMAIN || "localhost",
      emailDomainName: process.env.SIWE_DOMAIN || "localhost",
      anonymous: true,
      getNonce: async () => {
        return generateRandomString(32, "a-z", "A-Z", "0-9");
      },
      verifyMessage: async ({ message, signature, address }) => {
        try {
          const isValid = await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
          });
          return isValid;
        } catch {
          return false;
        }
      },
    }),
  ],
});
