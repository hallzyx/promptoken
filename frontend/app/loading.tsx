/**
 * Global loading skeleton displayed during route transitions.
 */
export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="space-y-6 text-center">
        <div className="skeleton mx-auto h-8 w-64 rounded" />
        <div className="skeleton mx-auto h-4 w-96 rounded" />
        <div className="skeleton mx-auto h-48 w-full max-w-md rounded-lg" />
      </div>
    </div>
  );
}
