"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { authClient } from "@/lib/auth-client";

/**
 * Bridges RainbowKit wallet connection to Better Auth SIWE.
 *
 * HEADLESS — no UI. When a wallet connects via RainbowKit, this
 * silently triggers the SIWE flow (MetaMask signature popup).
 * The session cookie is set automatically on success.
 */
export function SiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const authenticatingRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (!address || !isConnected || authenticatingRef.current) return;
    authenticatingRef.current = true;

    try {
      const { data: nonceData, error: nonceError } =
        await authClient.siwe.nonce({
          walletAddress: address,
          chainId: chainId ?? 16602,
        });

      if (nonceError || !nonceData?.nonce) return;

      const message = createSiweMessage({
        address,
        chainId: chainId ?? 16602,
        domain: window.location.hostname,
        uri: window.location.origin,
        version: "1",
        statement:
          "Sign in with Ethereum to Promptoken — the AI Prompt Marketplace on 0G.",
        nonce: nonceData.nonce,
        issuedAt: new Date(),
      });

      const signature = await signMessageAsync({ message });

      await authClient.siwe.verify({
        message,
        signature,
        walletAddress: address,
        chainId: chainId ?? 16602,
      });
    } catch {
      // User rejected or error — silently ignore
    } finally {
      authenticatingRef.current = false;
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address) {
      authenticate();
    }
  }, [isConnected, address, authenticate]);

  return null;
}
