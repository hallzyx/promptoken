"use client";

/**
 * Global error boundary displayed when a route crashes.
 * Provides a retry button to recover.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 font-mono text-xs tracking-widest uppercase text-red-400">
        Something went wrong
      </p>
      <p className="mb-6 max-w-md text-sm text-on-surface-variant">
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
