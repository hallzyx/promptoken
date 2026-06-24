"use client";

import { useReadContract, useWriteContract } from "wagmi";
import {
  PROMPT_LICENSE_ADDRESS,
  promptLicenseAbi,
} from "@/lib/contracts";
import { formatEther, truncateAddress } from "@/lib/utils";

interface EarningsCardProps {
  /** The connected wallet address (author). */
  authorAddress: `0x${string}`;
}

/**
 * Displays an author's total earned balance from PromptLicense
 * and a withdraw button.
 */
export function EarningsCard({ authorAddress }: EarningsCardProps) {
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: PROMPT_LICENSE_ADDRESS,
    abi: promptLicenseAbi,
    functionName: "getAuthorBalance",
    args: [authorAddress],
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const handleWithdraw = async () => {
    try {
      await writeContractAsync({
        address: PROMPT_LICENSE_ADDRESS,
        abi: promptLicenseAbi,
        functionName: "withdrawFunds",
      });
      // Refetch balance after a short delay
      setTimeout(refetchBalance, 3000);
    } catch {
      // Silently handle — errors shown are from wagmi notifications
    }
  };

  const earned = balance !== undefined ? formatEther(balance as bigint) : "—";

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-6">
      <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
        Total Earned
      </p>
      <p className="mb-4 font-mono text-2xl text-white">{earned}</p>

      <div className="mb-3">
        <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
          Author
        </p>
        <p className="font-mono text-xs text-primary">
          {truncateAddress(authorAddress)}
        </p>
      </div>

      <button
        onClick={handleWithdraw}
        disabled={
          isPending ||
          (balance !== undefined && (balance as bigint) === 0n)
        }
        className="w-full rounded-lg bg-primary-container px-4 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80 disabled:opacity-50"
      >
        {isPending ? "Withdrawing…" : "Withdraw Funds"}
      </button>
    </div>
  );
}
