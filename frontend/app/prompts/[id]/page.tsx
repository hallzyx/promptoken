"use client";

import { useEffect, useState, use } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  PROMPT_LICENSE_ADDRESS,
  promptLicenseAbi,
} from "@/lib/contracts";
import { truncateAddress, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface TierConfig {
  tier: number;
  price: string;
  enabled: boolean;
}

interface VersionInfo {
  storageHash: string;
  timestamp: number;
  versionNumber: number;
}

interface PromptDetail {
  id: number;
  author: string;
  storageHash: string;
  promptHash: string;
  metadataURI: string;
  createdAt: number;
  active: boolean;
  versionCount: number;
  latestVersion: VersionInfo | null;
  tiers: TierConfig[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const TIER_LABELS: Record<number, string> = {
  0: "Pay Per Call",
  1: "Fixed License",
  2: "Plaintext",
};

function formatPrice(wei: string): string {
  try {
    const formatted = formatEther(BigInt(wei));
    return `${formatted} 0G`;
  } catch {
    return `${wei} wei`;
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const promptId = BigInt(id);
  const { address, isConnected } = useAccount();

  const { writeContractAsync, isPending: txPending } = useWriteContract();

  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Purchase state
  const [callCount, setCallCount] = useState(1);
  const [durationDays, setDurationDays] = useState(30);

  // Execute state
  const [userMessage, setUserMessage] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);

  // Tx feedback
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  /* ---- fetch prompt detail ---- */
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/prompts/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to load");
        setPrompt(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load prompt");
        if (String(err).includes("404")) setError("Prompt not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  /* ---- purchase handler ---- */
  const handlePurchase = async (tier: number) => {
    if (!isConnected || !address) return;
    setTxHash(null);
    setTxError(null);

    try {
      const tierCfg = prompt!.tiers.find((t) => t.tier === tier);
      const unitPrice = BigInt(tierCfg?.price ?? "0");
      let hash: string;

      if (tier === 0) {
        // PayPerCall
        hash = await writeContractAsync({
          address: PROMPT_LICENSE_ADDRESS,
          abi: promptLicenseAbi,
          functionName: "purchaseCallLicense",
          args: [promptId, BigInt(callCount)],
          value: unitPrice * BigInt(callCount),
        });
      } else if (tier === 1) {
        // FixedLicense
        hash = await writeContractAsync({
          address: PROMPT_LICENSE_ADDRESS,
          abi: promptLicenseAbi,
          functionName: "purchaseFixedLicense",
          args: [promptId, BigInt(durationDays)],
          value: unitPrice,
        });
      } else {
        // Plaintext
        hash = await writeContractAsync({
          address: PROMPT_LICENSE_ADDRESS,
          abi: promptLicenseAbi,
          functionName: "purchasePlaintext",
          args: [promptId],
          value: unitPrice,
        });
      }

      setTxHash(hash);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  /* ---- execute handler ---- */
  const handleExecute = async () => {
    if (!userMessage.trim()) return;
    setExecuting(true);
    setExecResult(null);
    setExecError(null);

    try {
      const res = await fetch(`/api/prompts/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Execution failed");
      setExecResult(json.data.output);
      setRemainingCalls(json.data.remainingCalls);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  /* ---- loading skeleton ---- */
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="skeleton mb-6 h-8 w-64 rounded" />
        <div className="skeleton mb-4 h-4 w-96 rounded" />
        <div className="skeleton h-64 rounded-lg" />
      </div>
    );
  }

  /* ---- error / 404 ---- */
  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest uppercase text-red-400">
          Error
        </p>
        <p className="mb-6 text-on-surface-variant">{error}</p>
        <a
          href="/"
          className="font-mono text-xs tracking-widest uppercase text-primary underline"
        >
          ← Back to Marketplace
        </a>
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="bg-grid min-h-full">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
              Prompt #{prompt.id}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${
                prompt.active
                  ? "bg-primary-container/20 text-primary"
                  : "bg-on-surface-variant/10 text-on-surface-variant"
              }`}
            >
              {prompt.active ? "Active" : "Inactive"}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Prompt #{prompt.id}
          </h1>
        </div>

        {/* ── Meta info card ── */}
        <div className="mb-8 rounded-lg border border-outline-variant bg-surface p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                Author
              </p>
              <p className="font-mono text-xs text-white">
                {truncateAddress(prompt.author)}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                Created
              </p>
              <p className="font-mono text-xs text-white">
                {formatDate(BigInt(prompt.createdAt))}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                Versions
              </p>
              <p className="font-mono text-xs text-white">
                {prompt.versionCount}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                Storage
              </p>
              <p className="truncate font-mono text-xs text-primary">
                {prompt.storageHash.slice(0, 20)}...
              </p>
            </div>
          </div>
        </div>

        {/* ── Tier configs & purchase ── */}
        <div className="mb-8">
          <h2 className="mb-4 font-mono text-xs tracking-widest uppercase text-white">
            Licensing Tiers
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {prompt.tiers.map((tier) => (
              <div
                key={tier.tier}
                className={`rounded-lg border p-5 ${
                  tier.enabled
                    ? "border-outline-variant bg-surface"
                    : "border-outline-variant/40 bg-surface/50 opacity-50"
                }`}
              >
                <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                  {TIER_LABELS[tier.tier]}
                </p>
                <p className="mb-4 font-mono text-sm text-white">
                  {formatPrice(tier.price)}
                </p>

                {tier.enabled && isConnected ? (
                  <div className="space-y-3">
                    {tier.tier === 0 && (
                      <div className="flex items-center gap-2">
                        <label className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                          Calls:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={callCount}
                          onChange={(e) =>
                            setCallCount(Math.max(1, Number(e.target.value)))
                          }
                          className="w-20 rounded border border-outline-variant bg-background px-2 py-1 font-mono text-xs text-white"
                        />
                      </div>
                    )}
                    {tier.tier === 1 && (
                      <div className="flex items-center gap-2">
                        <label className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                          Days:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={durationDays}
                          onChange={(e) =>
                            setDurationDays(
                              Math.max(1, Number(e.target.value)),
                            )
                          }
                          className="w-20 rounded border border-outline-variant bg-background px-2 py-1 font-mono text-xs text-white"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => handlePurchase(tier.tier)}
                      disabled={txPending}
                      className="w-full rounded-lg bg-primary-container px-4 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80 disabled:opacity-50"
                    >
                      {txPending ? "Confirming…" : "Buy"}
                    </button>
                  </div>
                ) : tier.enabled && !isConnected ? (
                  <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                    Connect wallet to purchase
                  </p>
                ) : (
                  <p className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
                    Not available
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Tx feedback */}
          {txHash && (
            <p className="mt-3 font-mono text-xs text-primary">
              ✓ Tx sent: {truncateAddress(txHash)}
            </p>
          )}
          {txError && (
            <p className="mt-3 font-mono text-xs text-red-400">
              ✗ {txError}
            </p>
          )}
        </div>

        {/* ── Execute section ── */}
        <div className="mb-8 rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 font-mono text-xs tracking-widest uppercase text-white">
            Execute Prompt
          </h2>
          {remainingCalls !== null && (
            <p className="mb-3 font-mono text-[10px] tracking-widest uppercase text-secondary">
              Remaining calls: {remainingCalls}
            </p>
          )}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter your message…"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="flex-1 rounded-lg border border-outline-variant bg-background px-4 py-2 font-mono text-sm text-white placeholder-on-surface-variant outline-none focus:border-primary/50"
            />
            <button
              onClick={handleExecute}
              disabled={executing || !userMessage.trim()}
              className="rounded-lg bg-primary-container px-6 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80 disabled:opacity-50"
            >
              {executing ? "Running…" : "Run"}
            </button>
          </div>

          {/* Execute result or error */}
          {execResult && (
            <div className="mt-4 rounded border border-primary/20 bg-primary/5 p-4">
              <p className="mb-1 font-mono text-[10px] tracking-widest uppercase text-primary">
                Output
              </p>
              <p className="whitespace-pre-wrap text-sm text-white">
                {execResult}
              </p>
            </div>
          )}
          {execError && (
            <p className="mt-3 font-mono text-xs text-red-400">{execError}</p>
          )}
        </div>

        {/* ── Version history ── */}
        <div className="rounded-lg border border-outline-variant bg-surface p-6">
          <h2 className="mb-4 font-mono text-xs tracking-widest uppercase text-white">
            Version History
          </h2>
          {prompt.versionCount === 0 ? (
            <p className="text-sm text-on-surface-variant">No versions yet.</p>
          ) : (
            <div className="space-y-3">
              {prompt.latestVersion && (
                <div className="flex items-center justify-between rounded border border-outline-variant/50 px-4 py-3">
                  <div>
                    <p className="font-mono text-xs text-white">
                      v{prompt.latestVersion.versionNumber}
                    </p>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      {formatDate(BigInt(prompt.latestVersion.timestamp))}
                    </p>
                  </div>
                  <p className="truncate font-mono text-[10px] text-primary">
                    {prompt.latestVersion.storageHash.slice(0, 24)}...
                  </p>
                </div>
              )}
              {prompt.versionCount > 1 && (
                <p className="font-mono text-[10px] text-on-surface-variant">
                  + {prompt.versionCount - 1} older version(s)
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Back link ── */}
        <div className="mt-8">
          <a
            href="/"
            className="font-mono text-xs tracking-widest uppercase text-primary underline"
          >
            ← Back to Marketplace
          </a>
        </div>
      </div>
    </div>
  );
}
