import { type NextRequest } from "next/server";
import { promptRegistryContract } from "@/lib/contracts";

/**
 * Returns full detail for a single registered prompt, including its
 * version history and tier (monetisation) configuration.
 *
 * Route:  GET /api/prompts/:id
 */
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const promptId = BigInt(id);

    // getPrompt returns a tuple: [author, storageHash, promptHash, metadataURI, createdAt, active]
    const [author, storageHash, promptHash, metadataURI, createdAt, active] =
      await promptRegistryContract.read.getPrompt([promptId]);

    const versionCount =
      await promptRegistryContract.read.getVersionCount([promptId]);

    // Fetch the latest version metadata if one exists
    let latestVersion: {
      storageHash: string;
      timestamp: number;
      versionNumber: number;
    } | null = null;
    if (versionCount > 0n) {
      const lastIndex = versionCount - 1n;
      // getVersion returns a tuple: [storageHash, timestamp, versionNumber]
      const [vStorageHash, vTimestamp, vVersionNumber] =
        await promptRegistryContract.read.getVersion([promptId, lastIndex]);
      latestVersion = {
        storageHash: vStorageHash,
        timestamp: Number(vTimestamp),
        versionNumber: Number(vVersionNumber),
      };
    }

    // Read tier configuration for all three monetisation tiers
    const tierConfigs: Array<{
      tier: number;
      price: string;
      enabled: boolean;
    }> = [];
    for (let t = 0; t < 3; t++) {
      // getTierConfig returns a tuple: [price, enabled]
      const [price, enabled] =
        await promptRegistryContract.read.getTierConfig([promptId, t]);
      tierConfigs.push({
        tier: t,
        price: price.toString(),
        enabled,
      });
    }

    return Response.json({
      success: true,
      data: {
        id: Number(promptId),
        author,
        storageHash,
        promptHash,
        metadataURI,
        createdAt: Number(createdAt),
        active,
        versionCount: Number(versionCount),
        latestVersion,
        tiers: tierConfigs,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch prompt detail";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
