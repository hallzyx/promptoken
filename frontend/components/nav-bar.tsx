"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { WalletConnect } from "./wallet-connect";

/**
 * Top navigation bar with glass effect and StellarFlow styling.
 * Shows branding, navigation links, and wallet connect button.
 */
export function NavBar() {
  const { isConnected } = useAccount();

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
          {isConnected && (
            <Link
              href="/dashboard"
              className="font-mono text-xs tracking-widest uppercase text-on-surface-variant transition-colors hover:text-white"
            >
              Dashboard
            </Link>
          )}
          <WalletConnect />
        </nav>
      </div>
    </header>
  );
}
