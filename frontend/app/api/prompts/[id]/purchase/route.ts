import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { promptRegistryContract } from "@/lib/contracts";

/**
 * Prepare a purchase estimate for a prompt license.
 *
 * The caller provides the desired tier and (for call-based licenses)
 * the number of calls. The route returns the expected cost in wei so
 * the client can present a confirmation dialog before sending the
 * actual transaction.
 *
 * Body:
 *   - tier         (number)  0 = PayPerCall, 1 = FixedLicense, 2 = Plaintext
 *   - calls        (number)  Required for tier 0 (PayPerCall)
 *   - durationDays (number)  Required for tier 1 (FixedLicense)
 *
 * Returns { expectedCost, tier, promptId }.
 */
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.address) {
      return Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const promptId = BigInt(id);
    const body = await request.json();
    const { tier, calls, durationDays } = body;

    if (tier === undefined || ![0, 1, 2].includes(tier)) {
      return Response.json(
        {
          success: false,
          error:
            "tier must be 0 (PayPerCall), 1 (FixedLicense), or 2 (Plaintext)",
        },
        { status: 400 },
      );
    }

    // Fetch tier config from the contract
    // getTierConfig returns a tuple: [price, enabled]
    const [price, enabled] =
      await promptRegistryContract.read.getTierConfig([
        promptId,
        tier,
      ]);

    if (!enabled) {
      return Response.json(
        {
          success: false,
          error: `Tier ${tier} is not enabled for this prompt`,
        },
        { status: 400 },
      );
    }

    let expectedCost: bigint;

    switch (tier) {
      case 0: // PayPerCall
        if (!calls || typeof calls !== "number" || calls < 1) {
          return Response.json(
            {
              success: false,
              error:
                "calls (number, >= 1) is required for PayPerCall tier",
            },
            { status: 400 },
          );
        }
        expectedCost = price * BigInt(calls);
        break;
      case 1: // FixedLicense
        if (
          !durationDays ||
          typeof durationDays !== "number" ||
          durationDays < 1
        ) {
          return Response.json(
            {
              success: false,
              error:
                "durationDays (number, >= 1) is required for FixedLicense tier",
            },
            { status: 400 },
          );
        }
        expectedCost = price;
        break;
      case 2: // Plaintext
        expectedCost = price;
        break;
      default:
        return Response.json(
          { success: false, error: "Invalid tier" },
          { status: 400 },
        );
    }

    return Response.json({
      success: true,
      data: {
        expectedCost: expectedCost.toString(),
        tier,
        promptId: Number(promptId),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare purchase";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
