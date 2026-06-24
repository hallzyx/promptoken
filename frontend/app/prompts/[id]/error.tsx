"use client";

/**
 * Error boundary for the prompt detail page.
 */
export default function PromptDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
      <p className="mb-3 font-mono text-xs tracking-widest uppercase text-red-400">
        Failed to load prompt
      </p>
      <p className="mb-6 text-sm text-on-surface-variant">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary-container px-6 py-2 font-mono text-xs tracking-widest uppercase text-white transition-colors hover:bg-primary-container/80"
      >
        Try Again
      </button>
    </div>
  );
}
