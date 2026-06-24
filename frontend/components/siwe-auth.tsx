"use client";

import { useEffect, useCallback, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { authClient } from "@/lib/auth-client";

type AuthState = "idle" | "signing" | "verifying" | "authenticated" | "error";

/**
 * Bridges RainbowKit wallet connection to Better Auth SIWE.
 *
 * When a user connects their wallet via RainbowKit, this component
 * automatically:
 *   1. Requests a SIWE nonce from the server
 *   2. Creates an EIP-4361 message with the nonce
 *   3. Asks the user to sign via their wallet
 *   4. Sends the signature to Better Auth for verification
 *   5. On success, the server creates an HTTP-only session cookie
 *
 * The session is then available in all API routes via getServerSession().
 */
export function SiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!address || !isConnected) return;

    try {
      setAuthState("signing");
      setError(null);

      // 1. Get a unique nonce from the server
      const { data: nonceData, error: nonceError } =
        await authClient.siwe.nonce({
          walletAddress: address,
          chainId: chainId ?? 16602,
        });

      if (nonceError || !nonceData?.nonce) {
        throw new Error(nonceError?.message || "Failed to get nonce");
      }

      // 2. Create the SIWE message (EIP-4361)
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

      // 3. Ask the wallet to sign
      const signature = await signMessageAsync({ message });

      // 4. Verify with the server
      const { data: verifyData, error: verifyError } =
        await authClient.siwe.verify({
          message,
          signature,
          walletAddress: address,
          chainId: chainId ?? 16602,
        });

      if (verifyError || !verifyData) {
        throw new Error(verifyError?.message || "Verification failed");
      }

      setAuthState("authenticated");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      setAuthState("error");
    }
  }, [address, isConnected, chainId, signMessageAsync]);

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (isConnected && address && authState === "idle") {
      authenticate();
    }
  }, [isConnected, address, authState, authenticate]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected && authState !== "idle") {
      setAuthState("idle");
      setError(null);
    }
  }, [isConnected, authState]);

  // Don't show anything when not connected — the ConnectButton handles that
  if (authState === "idle") {
    return null;
  }

  if (authState === "signing") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-secondary" />
        <span className="font-mono text-xs tracking-widest uppercase text-secondary">
          Sign message in wallet…
        </span>
      </div>
    );
  }

  if (authState === "authenticated") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        <span className="font-mono text-xs tracking-widest uppercase text-green-400">
          Authenticated
        </span>
        <span className="font-mono text-[10px] text-on-surface-variant">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="ml-2 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        <span className="font-mono text-xs tracking-widest uppercase text-red-400">
          Auth Error
        </span>
      </div>
      <p className="font-mono text-[10px] text-on-surface-variant">{error}</p>
      <button
        onClick={() => {
          setAuthState("idle");
          setError(null);
        }}
        className="font-mono text-[10px] tracking-widest uppercase text-primary hover:underline"
      >
        Retry
      </button>
    </div>
  );
}
