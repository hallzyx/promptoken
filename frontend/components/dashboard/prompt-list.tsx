"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { truncateAddress } from "@/lib/utils";

/** Minimal prompt shape for the dashboard list. */
interface DashboardPrompt {
  id: number;
  author: string;
  createdAt: number;
  active: boolean;
}

interface PromptListProps {
  /** The wallet address to fetch prompts for. */
  authorAddress: `0x${string}`;
}

/**
 * Lists all prompts owned by the given author address.
 * Fetches from GET /api/prompts?author=<address>.
 */
export function PromptList({ authorAddress }: PromptListProps) {
  const [prompts, setPrompts] = useState<DashboardPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/prompts?author=${authorAddress}&limit=100`,
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to load");
        setPrompts(json.data.prompts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load prompts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authorAddress]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface p-6 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-red-400">
          Error
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">{error}</p>
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface p-6 text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-on-surface-variant">
          No prompts yet
        </p>
        <Link
          href="/register"
          className="mt-3 inline-block font-mono text-xs tracking-widest uppercase text-primary underline"
        >
          Register your first prompt →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prompts.map((p) => (
        <Link
          key={p.id}
          href={`/prompts/${p.id}`}
          className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface p-4 transition-colors hover:border-primary/30"
        >
          <div>
            <p className="font-mono text-sm text-white">Prompt #{p.id}</p>
            <p className="font-mono text-[10px] text-on-surface-variant">
              {new Date(p.createdAt * 1000).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${
                p.active
                  ? "bg-primary-container/20 text-primary"
                  : "bg-on-surface-variant/10 text-on-surface-variant"
              }`}
            >
              {p.active ? "Active" : "Inactive"}
            </span>
            <span className="font-mono text-xs text-primary">→</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
