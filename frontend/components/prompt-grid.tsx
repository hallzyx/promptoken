import { PromptCard } from "./prompt-card";

/**
 * Shape returned by the GET /api/prompts route for each prompt.
 */
interface PromptGridPrompt {
  id: number;
  author: string;
  storageHash: string;
  promptHash: string;
  metadataURI: string;
  createdAt: number;
  active: boolean;
}

interface PromptGridProps {
  prompts: PromptGridPrompt[];
  loading?: boolean;
  error?: string | null;
}

/** Number of skeleton cards shown while loading. */
const SKELETON_COUNT = 6;

/**
 * A responsive grid of prompt cards with loading skeleton and empty state.
 */
export function PromptGrid({ prompts, loading, error }: PromptGridProps) {
  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="skeleton h-52 rounded-lg" />
        ))}
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface p-12 text-center">
        <p className="mb-2 font-mono text-xs tracking-widest uppercase text-red-400">
          Error
        </p>
        <p className="text-sm text-on-surface-variant">{error}</p>
      </div>
    );
  }

  /* ── Empty state ── */
  if (!prompts.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant bg-surface p-12 text-center">
        <p className="mb-2 font-mono text-sm tracking-widest uppercase text-on-surface-variant">
          No prompts yet
        </p>
        <p className="max-w-md text-sm text-on-surface-variant">
          Be the first to share your prompt on the 0G Network. Connect your
          wallet and register a prompt to get started.
        </p>
      </div>
    );
  }

  /* ── Prompt grid ── */
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {prompts.map((prompt) => (
        <PromptCard key={prompt.id} prompt={prompt} />
      ))}
    </div>
  );
}
