"use client";

import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/wallet-connect";
import { LicenseTable } from "@/components/dashboard/license-table";
import Link from "next/link";

/**
 * Consumer dashboard showing active licenses and execution history.
 *
 * For MVP, we pass a curated list of prompt IDs to the license table.
 * In production, this would be fetched from a backend indexer
 * tracking the consumer's on-chain interactions.
 */
export default function ConsumerDashboardPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
          Consumer Dashboard
        </p>
        <h1 className="mb-4 text-2xl font-bold text-white">
          Connect Your Wallet
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Connect your wallet to see your active licenses and prompt execution
          history.
        </p>
        <WalletConnect />
      </div>
    );
  }

  // MVP: scan a range of prompt IDs to find active licenses.
  // In production this would come from an indexer.
  const scannedIds = Array.from({ length: 50 }, (_, i) => i + 1);

  return (
    <div className="bg-grid min-h-full">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Consumer Dashboard
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Your active licenses and execution credits.
          </p>
        </div>

        {/* License table */}
        <div className="mb-8">
          <h2 className="mb-4 font-mono text-xs tracking-widest uppercase text-white">
            Active Licenses
          </h2>
          <LicenseTable
            consumerAddress={address}
            promptIds={scannedIds}
          />
        </div>

        {/* Quick links */}
        <div className="flex gap-4">
          <Link
            href="/"
            className="rounded-lg border border-outline-variant bg-surface px-5 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:border-primary/30"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-outline-variant bg-surface px-5 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:border-primary/30"
          >
            Author Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
