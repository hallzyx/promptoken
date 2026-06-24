import { type NextRequest } from "next/server";
import { promptRegistryContract } from "@/lib/contracts";

/**
 * List registered prompts, optionally filtered by author.
 *
 * When an `author` query parameter is provided, paginates through that
 * author's prompts using PromptRegistry.getAuthorPromptCount and
 * getPromptIdByIndex. Without an author filter this returns an empty
 * list — a full on-chain event indexer would be needed for unfiltered
 * enumeration.
 *
 * Query params:
 *   - author  (optional)  Ethereum address to filter by
 *   - page    (optional)  1-indexed page number (default: 1)
 *   - limit   (optional)  Items per page (default: 10, max: 100)
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const author = searchParams.get("author");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );

    const prompts: Array<{
      id: number;
      author: string;
      storageHash: string;
      promptHash: string;
      metadataURI: string;
      createdAt: number;
      active: boolean;
    }> = [];
    let total = 0;

    if (author) {
      const count =
        await promptRegistryContract.read.getAuthorPromptCount([
          author as `0x${string}`,
        ]);
      total = Number(count);
      const start = (page - 1) * limit;
      const end = Math.min(start + limit, total);

      for (let i = start; i < end; i++) {
        const promptId =
          await promptRegistryContract.read.getPromptIdByIndex([
            author as `0x${string}`,
            BigInt(i),
          ]);
        // getPrompt returns a tuple: [author, storageHash, promptHash, metadataURI, createdAt, active]
        const [promptAuthor, storageHash, promptHash, metadataURI, createdAt, active] =
          await promptRegistryContract.read.getPrompt([promptId]);
        prompts.push({
          id: Number(promptId),
          author: promptAuthor,
          storageHash,
          promptHash,
          metadataURI,
          createdAt: Number(createdAt),
          active,
        });
      }
    }

    return Response.json({
      success: true,
      data: {
        prompts,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch prompts";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
