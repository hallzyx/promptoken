import Link from "next/link";
import { truncateAddress, formatEther } from "@/lib/utils";

/**
 * Shape returned by the GET /api/prompts route for each prompt.
 */
interface PromptCardPrompt {
  id: number;
  author: string;
  storageHash: string;
  promptHash: string;
  metadataURI: string;
  createdAt: number;
  active: boolean;
}

interface PromptCardProps {
  prompt: PromptCardPrompt;
}

/**
 * A card displaying a single prompt's summary, following StellarFlow
 * design (surface background, 1px outline-variant border, mono labels).
 */
export function PromptCard({ prompt }: PromptCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-outline-variant bg-surface p-6 transition-colors hover:border-primary/30">
      {/* Title / ID */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          Prompt #{prompt.id}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${
            prompt.active
              ? "bg-primary-container/20 text-primary"
              : "bg-on-surface-variant/10 text-on-surface-variant"
          }`}
        >
          {prompt.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Author */}
      <p className="mb-1 text-sm text-on-surface-variant">
        Author:{" "}
        <span className="font-mono text-xs">
          {truncateAddress(prompt.author)}
        </span>
      </p>

      {/* Storage hash */}
      <p className="mb-4 truncate font-mono text-[11px] text-on-surface-variant">
        Storage: {prompt.storageHash.slice(0, 20)}...
      </p>

      {/* CTA */}
      <div className="mt-auto flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="font-mono text-[10px] tracking-widest uppercase text-on-surface-variant">
          {new Date(prompt.createdAt * 1000).toLocaleDateString()}
        </span>
        <Link
          href={`/prompts/${prompt.id}`}
          className="font-mono text-xs tracking-widest uppercase text-primary transition-colors hover:text-primary/80"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
