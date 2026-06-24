import { getServerSession } from "@/lib/auth-utils";
import {
  publicClient,
  PROMPT_REGISTRY_ADDRESS,
  promptRegistryAbi,
  promptRegistryContract,
} from "@/lib/contracts";
import { zeroGTestnet } from "@/lib/chain";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { uploadToStorage } from "@/lib/storage";

/**
 * Register a new prompt: upload encrypted data to 0G Storage, then
 * register on-chain via PromptRegistry.registerPrompt.
 *
 * Body (updated for real storage upload):
 *   - encryptedData  (hex)         AES-256-GCM ciphertext
 *   - iv             (hex)         12-byte initialization vector
 *   - promptHash     (0x-prefixed) keccak256 of the plaintext prompt
 *   - promptName     (string)      Display name
 *   - description    (string)      Brief description
 *   - tiers          (array)       [{ price: string, enabled: boolean }]
 *
 * Returns { promptId, txHash, storageHash }.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();

    // --- validate required fields ---
    const { encryptedData, iv, promptHash, promptName, description, tiers } =
      body;

    if (!encryptedData || typeof encryptedData !== "string") {
      return Response.json(
        { success: false, error: "encryptedData (hex) is required" },
        { status: 400 },
      );
    }
    if (!iv || typeof iv !== "string") {
      return Response.json(
        { success: false, error: "iv (hex) is required" },
        { status: 400 },
      );
    }
    if (!promptHash || typeof promptHash !== "string") {
      return Response.json(
        { success: false, error: "promptHash is required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return Response.json(
        { success: false, error: "tiers array is required" },
        { status: 400 },
      );
    }

    const validatedTiers = tiers.map(
      (t: { price?: string; enabled?: boolean }, i: number) => {
        const price = BigInt(t.price ?? "0");
        if (price < 0n) throw new Error(`Invalid price at tier index ${i}`);
        return { price, enabled: t.enabled ?? false };
      },
    );

    // --- normalize private key ---
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return Response.json(
        { success: false, error: "Server wallet not configured" },
        { status: 500 },
      );
    }
    const normalizedKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;
    const serverAccount = privateKeyToAccount(normalizedKey as `0x${string}`);

    // --- upload encrypted data to 0G Storage ---
    // Build raw bytes: iv (12 bytes) + ciphertext
    function hexToBytes(hex: string): Uint8Array {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    }

    const ivClean = iv.startsWith("0x") ? iv.slice(2) : iv;
    const dataClean = encryptedData.startsWith("0x")
      ? encryptedData.slice(2)
      : encryptedData;

    const rawData = new Uint8Array(
      (ivClean.length + dataClean.length) / 2,
    );
    rawData.set(hexToBytes(ivClean), 0);
    rawData.set(hexToBytes(dataClean), ivClean.length / 2);

    let storageHash: string;
    try {
      storageHash = await uploadToStorage(rawData);
    } catch (uploadErr) {
      const msg =
        uploadErr instanceof Error ? uploadErr.message : "Storage upload failed";
      return Response.json({ success: false, error: msg }, { status: 500 });
    }

    // --- build metadata URI ---
    const metadataURI = JSON.stringify({
      name: promptName || `Prompt #${Date.now()}`,
      description: description || "",
      iv,
      author: serverAccount.address,
      version: 1,
    });

    // --- on-chain registration ---
    const walletClient = createWalletClient({
      account: serverAccount,
      chain: zeroGTestnet,
      transport: http(),
    });

    const authorCountBefore =
      await promptRegistryContract.read.getAuthorPromptCount([
        serverAccount.address,
      ]);

    // simulateContract and writeContract with explicit account for local signing
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
      account: serverAccount,
    });

    const txHash = await walletClient.writeContract({
      ...callRequest,
      account: serverAccount,
    } as any);

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
