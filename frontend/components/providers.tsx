"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { zeroGTestnet } from "@/lib/chain";
import "@rainbow-me/rainbowkit/styles.css";

/**
 * wagmi configuration for the 0G Galileo testnet.
 */
const config = createConfig({
  chains: [zeroGTestnet],
  transports: {
    [zeroGTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

/**
 * Root providers wrapping the entire app:
 * - WagmiProvider (wallet connection)
 * - QueryClientProvider (react-query for wagmi)
 * - RainbowKitProvider (connect wallet UI)
 * - SessionProvider (next-auth / SIWE session)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <SessionProvider>{children}</SessionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
