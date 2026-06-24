"use client";

import { useReadContract } from "wagmi";
import {
  PROMPT_LICENSE_ADDRESS,
  promptLicenseAbi,
} from "@/lib/contracts";

interface LicenseTableProps {
  /** The connected wallet address (consumer). */
  consumerAddress: `0x${string}`;
  /** Array of prompt IDs the consumer might have licenses for. */
  promptIds: number[];
}

/**
 * Displays a table of active licenses for a given consumer.
 * Reads remaining calls and expiry from PromptLicense for each prompt ID.
 */
export function LicenseTable({
  consumerAddress,
  promptIds,
}: LicenseTableProps) {
  if (!promptIds.length) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface p-8 text-center">
        <p className="font-mono text-sm tracking-widest uppercase text-on-surface-variant">
          No licenses yet
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Purchase a license from the marketplace to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {promptIds.map((pid) => (
        <LicenseRow
          key={pid}
          promptId={BigInt(pid)}
          consumer={consumerAddress}
        />
      ))}
    </div>
  );
}

/* ── Individual license row ── */
function LicenseRow({
  promptId,
  consumer,
}: {
  promptId: bigint;
  consumer: `0x${string}`;
}) {
  const { data: remaining } = useReadContract({
    address: PROMPT_LICENSE_ADDRESS,
    abi: promptLicenseAbi,
    functionName: "getRemainingCalls",
    args: [promptId, consumer],
  });

  const { data: expiry } = useReadContract({
    address: PROMPT_LICENSE_ADDRESS,
    abi: promptLicenseAbi,
    functionName: "getLicenseExpiry",
    args: [promptId, consumer],
  });

  // Skip if no active license (0 remaining and no expiry)
  const remainingNum = remaining !== undefined ? Number(remaining) : null;
  const expiryNum = expiry !== undefined ? Number(expiry) : null;
  const hasLicense =
    remainingNum !== null &&
    remainingNum > 0 &&
    expiryNum !== null &&
    (expiryNum === 0 || expiryNum * 1000 > Date.now());

  if (!hasLicense) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface px-5 py-4">
      <div>
        <p className="font-mono text-sm text-white">Prompt #{promptId.toString()}</p>
        <div className="mt-1 flex gap-4">
          <span className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
            Calls left:{" "}
            <span className="text-secondary">{remainingNum}</span>
          </span>
          {expiryNum && expiryNum > 0 && (
            <span className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
              Expires:{" "}
              <span className="text-primary">
                {new Date(expiryNum * 1000).toLocaleDateString()}
              </span>
            </span>
          )}
        </div>
      </div>
      <a
        href={`/prompts/${promptId.toString()}`}
        className="font-mono text-xs tracking-widest uppercase text-primary transition-colors hover:text-primary/80"
      >
        Execute →
      </a>
    </div>
  );
}
