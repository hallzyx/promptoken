import { type NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth-utils";
import {
  publicClient,
  promptRegistryContract,
  promptLicenseContract,
  PROMPT_LICENSE_ADDRESS,
  promptLicenseAbi,
} from "@/lib/contracts";
import { zeroGTestnet } from "@/lib/chain";
import { createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { downloadFromStorage } from "@/lib/storage";
import { generateKey, decryptPrompt } from "@/lib/encryption";

/**
 * Execute a prompt with a user message.
 *
 * Flow:
 *   1. Authenticate the consumer via SIWE session
 *   2. Verify the consumer has remaining call credits
 *   3. Download the encrypted prompt from 0G Storage
 *   4. Decrypt it using the server private key
 *   5. Call the configured LLM endpoint (or return a mock response)
 *   6. Record the execution on-chain via PromptLicense.executeCall
 *   7. Return the LLM output, tx hash, and remaining calls
 */
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const promptId = BigInt(id);
    // Better Auth SIWE stores wallet as {address}@{domain} in email
    const consumerAddress = (session.user.email?.split("@")[0] ?? "") as `0x${string}`;
    const { userMessage } = await request.json();

    if (!userMessage || typeof userMessage !== "string") {
      return Response.json(
        { success: false, error: "userMessage is required" },
        { status: 400 },
      );
    }

    // --- verify remaining calls ---
    const remainingCalls =
      await promptLicenseContract.read.getRemainingCalls([
        promptId,
        consumerAddress,
      ]);

    if (remainingCalls === 0n) {
      return Response.json(
        {
          success: false,
          error: "No remaining calls — purchase a license first",
        },
        { status: 402 },
      );
    }

    // --- download encrypted prompt from 0G Storage ---
    // getPrompt returns a tuple: [author, storageHash, promptHash, metadataURI, createdAt, active]
    const [, storageHash] =
      await promptRegistryContract.read.getPrompt([promptId]);

    const encryptedData = await downloadFromStorage(storageHash);

    // --- decrypt: first 12 bytes = IV, remainder = ciphertext + GCM tag ---
    const ivBytes = encryptedData.slice(0, 12);
    const cipherBytes = encryptedData.slice(12);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return Response.json(
        { success: false, error: "Server wallet not configured" },
        { status: 500 },
      );
    }

    const key = await generateKey(privateKey);
    const plaintextPrompt = await decryptPrompt(
      toHex(cipherBytes),
      toHex(ivBytes),
      key,
    );

    // --- call LLM or return mock response ---
    let output: string;
    const openAiKey = process.env.OPENAI_API_KEY;
    const llmEndpoint =
      process.env.LLM_ENDPOINT || "https://api.openai.com/v1/chat/completions";

    if (openAiKey) {
      const llmResponse = await fetch(llmEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: plaintextPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: parseInt(process.env.LLM_MAX_TOKENS || "1024", 10),
        }),
      });

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        throw new Error(
          `LLM request failed: ${llmResponse.status} — ${errorBody}`,
        );
      }

      const llmData = await llmResponse.json();
      output = llmData.choices?.[0]?.message?.content || "";
    } else {
      // Mock response for development / demo
      output = `[Mock LLM response] Decrypted prompt: "${plaintextPrompt.slice(0, 80)}…"\n\nUser message: "${userMessage}"\n\nThis is a simulated response because no OPENAI_API_KEY is configured.`;
    }

    // --- submit executeCall tx ---
    const serverAccount = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account: serverAccount,
      chain: zeroGTestnet,
      transport: http(),
    });

    const { request: callRequest } = await publicClient.simulateContract({
      address: PROMPT_LICENSE_ADDRESS,
      abi: promptLicenseAbi,
      functionName: "executeCall",
      args: [promptId, consumerAddress],
      account: serverAccount.address,
    });

    const txHash = await walletClient.writeContract(callRequest);

    // --- read updated remaining calls ---
    const updatedRemaining =
      await promptLicenseContract.read.getRemainingCalls([
        promptId,
        consumerAddress,
      ]);

    return Response.json({
      success: true,
      data: {
        output,
        txHash,
        remainingCalls: Number(updatedRemaining),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to execute prompt";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
