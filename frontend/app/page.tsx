"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { usePublicClient } from "wagmi";
import { parseAbi } from "viem";
import {
  PROMPT_REGISTRY_ADDRESS,
  promptRegistryAbi,
} from "@/lib/contracts";
import { PromptGrid } from "@/components/prompt-grid";
import { WalletConnect } from "@/components/wallet-connect";

/** Internal type for prompts fetched on-chain. */
interface PromptItem {
  id: number;
  author: string;
  storageHash: string;
  promptHash: string;
  metadataURI: string;
  createdAt: number;
  active: boolean;
}

/** Maximum prompt ID to scan (MVP — no event indexer). */
const MAX_PROMPT_ID = 100;

export default function MarketplacePage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<number | null>(null);

  /**
   * Fetch prompts by iterating through on-chain IDs.
   * In production this would use an event indexer.
   */
  const fetchPrompts = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    setError(null);

    try {
      const results: PromptItem[] = [];

      for (let id = 1; id <= MAX_PROMPT_ID; id++) {
        try {
          const [author, storageHash, promptHash, metadataURI, createdAt, active] =
            await publicClient.readContract({
              address: PROMPT_REGISTRY_ADDRESS,
              abi: promptRegistryAbi,
              functionName: "getPrompt",
              args: [BigInt(id)],
            }) as [string, string, `0x${string}`, string, bigint, boolean];

          // Skip if zero address (non-existent prompt)
          if (author === "0x0000000000000000000000000000000000000000") continue;

          // Apply author filter if set
          if (
            authorFilter &&
            author.toLowerCase() !== authorFilter.toLowerCase()
          ) {
            continue;
          }

          // Apply tier filter if set
          if (tierFilter !== null) {
            const [, tierEnabled] = await publicClient.readContract({
              address: PROMPT_REGISTRY_ADDRESS,
              abi: parseAbi([
                "function getTierConfig(uint256 promptId, uint8 tier) external view returns (uint256 price, bool enabled)",
              ] as const),
              functionName: "getTierConfig",
              args: [BigInt(id), tierFilter],
            }) as [bigint, boolean];

            if (!tierEnabled) continue;
          }

          results.push({
            id,
            author,
            storageHash,
            promptHash,
            metadataURI,
            createdAt: Number(createdAt),
            active,
          });
        } catch {
          // Revert means prompt doesn't exist — stop scanning
          break;
        }
      }

      setPrompts(results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch prompts";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [publicClient, authorFilter, tierFilter]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return (
    <div className="bg-grid min-h-full">
      {/* ── Hero section ── */}
      <section className="border-b border-outline-variant">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <h1 className="mb-4 font-mono text-sm tracking-[0.3em] uppercase text-primary">
            AI Prompt Marketplace
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-4xl font-bold leading-tight tracking-tighter text-white sm:text-5xl">
            Register, license, and govern
            <br />
            <span className="text-primary">AI prompts</span> on 0G Network
          </p>
          <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-on-surface-variant">
            A decentralised marketplace for prompt IP. Publish your prompts,
            monetise them with flexible licensing, and let consumers run
            inferences against them — all on-chain.
          </p>

          {!isConnected && (
            <div className="inline-flex items-center gap-3">
              <span className="font-mono text-xs tracking-widest uppercase text-on-surface-variant">
                Get started —
              </span>
              <WalletConnect />
            </div>
          )}
        </div>
      </section>

      {/* ── Filters + prompt grid ── */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        {/* Filter bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-mono text-xs tracking-widest uppercase text-white">
            All Prompts
            {prompts.length > 0 && (
              <span className="ml-2 text-on-surface-variant">
                ({prompts.length})
              </span>
            )}
          </h2>

          <div className="flex items-center gap-3">
            {/* Author filter input */}
            <input
              type="text"
              placeholder="Filter by address…"
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-mono text-xs text-white placeholder-on-surface-variant outline-none focus:border-primary/50"
            />

            {/* Tier filter */}
            <select
              value={tierFilter ?? ""}
              onChange={(e) =>
                setTierFilter(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-primary/50"
            >
              <option value="">All Tiers</option>
              <option value={0}>Pay Per Call</option>
              <option value={1}>Fixed License</option>
              <option value={2}>Plaintext</option>
            </select>
          </div>
        </div>

        {/* Grid / loading / empty */}
        <PromptGrid prompts={prompts} loading={loading} error={error} />
      </section>
    </div>
  );
}
