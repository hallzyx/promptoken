import { defineChain } from "viem";

/**
 * 0G Galileo Testnet chain configuration for wagmi/viem.
 */
export const zeroGTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_L1_RPC || "https://evmrpc-testnet.0g.ai",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "0GScan",
      url: "https://chainscan-galileo.0g.ai",
    },
  },
  testnet: true,
});
