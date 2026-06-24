"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { WalletConnect } from "./wallet-connect";
import { SiweAuth } from "./siwe-auth";

/**
 * Top navigation bar with glass effect and StellarFlow styling.
 * Shows branding, navigation links, and wallet connect button.
 * SiweAuth runs silently in the background on wallet connect.
 * Uses mounted pattern to prevent hydration mismatch from wagmi's useAccount.
 */
export function NavBar() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand */}
        <Link
          href="/"
          className="font-mono text-sm font-bold tracking-widest uppercase text-primary"
        >
          Promptoken
        </Link>

        {/* Right section */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="font-mono text-xs tracking-widest uppercase text-on-surface-variant transition-colors hover:text-white"
          >
            Marketplace
          </Link>
          <Link
            href="/register"
            className="font-mono text-xs tracking-widest uppercase text-on-surface-variant transition-colors hover:text-white"
          >
            Register
          </Link>
          {mounted && isConnected && (
            <Link
              href="/dashboard"
              className="font-mono text-xs tracking-widest uppercase text-on-surface-variant transition-colors hover:text-white"
            >
              Dashboard
            </Link>
          )}
          {mounted && <SiweAuth />}
          {mounted && <WalletConnect />}
        </nav>
      </div>
    </header>
  );
}
