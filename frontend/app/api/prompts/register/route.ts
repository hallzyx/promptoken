import { auth } from "@/lib/auth";
import {
  publicClient,
  promptRegistryContract,
  PROMPT_REGISTRY_ADDRESS,
  promptRegistryAbi,
} from "@/lib/contracts";
import { zeroGTestnet } from "@/lib/chain";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Register a new prompt on-chain.
 *
 * The client must already have uploaded the encrypted prompt to 0G
 * storage and holds the resulting storage hash. This route wraps the
 * PromptRegistry.registerPrompt call using the server wallet.
 *
 * Body:
 *   - storageHash   (string)       Root hash from 0G storage
 *   - promptHash    (0x-prefixed)  keccak256 of the plaintext prompt
 *   - metadataURI   (string)       Off-chain metadata URI
 *   - tiers         (array)        Monetisation tier configs
 *       [{ price: string, enabled: boolean }]
 *
 * Returns { promptId, txHash, storageHash }.
 *
 * @dev In the MVP the server wallet is the msg.sender (author) of
 *      registerPrompt. The follow-up read uses the server wallet
 *      address to locate the newly created promptId.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.address) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();

    // --- validate required fields ---
    const { storageHash, promptHash, metadataURI, tiers } = body;
    if (!storageHash || typeof storageHash !== "string") {
      return Response.json(
        { success: false, error: "storageHash is required" },
        { status: 400 },
      );
    }
    if (!promptHash || typeof promptHash !== "string") {
      return Response.json(
        { success: false, error: "promptHash is required" },
        { status: 400 },
      );
    }
    if (!metadataURI || typeof metadataURI !== "string") {
      return Response.json(
        { success: false, error: "metadataURI is required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return Response.json(
        { success: false, error: "tiers array is required" },
        { status: 400 },
      );
    }

    // Ensure tiers have the right shape
    const validatedTiers = tiers.map(
      (t: { price?: string; enabled?: boolean }, i: number) => {
        const price = BigInt(t.price ?? "0");
        if (price < 0n) {
          throw new Error(`Invalid price at tier index ${i}`);
        }
        return { price, enabled: t.enabled ?? false };
      },
    );

    // --- on-chain registration ---
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return Response.json(
        { success: false, error: "Server wallet not configured" },
        { status: 500 },
      );
    }

    const serverAccount = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account: serverAccount,
      chain: zeroGTestnet,
      transport: http(),
    });

    // Record the server wallet's prompt count before registration
    const authorCountBefore =
      await promptRegistryContract.read.getAuthorPromptCount([
        serverAccount.address,
      ]);

    const { request: callRequest } = await publicClient.simulateContract({
      address: PROMPT_REGISTRY_ADDRESS,
      abi: promptRegistryAbi,
      functionName: "registerPrompt",
      args: [
        storageHash,
        promptHash as `0x${string}`,
        metadataURI,
        validatedTiers,
      ],
      account: serverAccount.address,
    });

    const txHash = await walletClient.writeContract(callRequest);

    // The new prompt is the latest one for the server wallet address
    // (msg.sender of registerPrompt in the MVP / onlyOwner pattern).
    const promptId =
      await promptRegistryContract.read.getPromptIdByIndex([
        serverAccount.address,
        authorCountBefore,
      ]);

    return Response.json({
      success: true,
      data: {
        promptId: Number(promptId),
        txHash,
        storageHash,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register prompt";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
