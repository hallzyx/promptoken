"use client";

import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/wallet-connect";
import { EarningsCard } from "@/components/dashboard/earnings-card";
import { PromptList } from "@/components/dashboard/prompt-list";
import Link from "next/link";

export default function AuthorDashboardPage() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="mb-3 font-mono text-xs tracking-widest uppercase text-on-surface-variant">
          Dashboard
        </p>
        <h1 className="mb-4 text-2xl font-bold text-white">
          Connect Your Wallet
        </h1>
        <p className="mb-6 text-sm text-on-surface-variant">
          Connect your wallet to view your prompts, earnings, and manage
          licenses.
        </p>
        <WalletConnect />
      </div>
    );
  }

  return (
    <div className="bg-grid min-h-full">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tighter text-white">
            Author Dashboard
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Manage your prompts, track earnings, and withdraw funds.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column — prompt list */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-xs tracking-widest uppercase text-white">
                Your Prompts
              </h2>
              <Link
                href="/register"
                className="font-mono text-xs tracking-widest uppercase text-primary underline"
              >
                + New Prompt
              </Link>
            </div>
            <PromptList authorAddress={address} />
          </div>

          {/* Right column — earnings */}
          <div>
            <EarningsCard authorAddress={address} />
          </div>
        </div>
      </div>
    </div>
  );
}
