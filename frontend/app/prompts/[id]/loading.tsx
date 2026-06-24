/**
 * Loading skeleton for the prompt detail page.
 */
export default function PromptDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="skeleton mb-6 h-8 w-64 rounded" />
      <div className="skeleton mb-4 h-4 w-96 rounded" />
      <div className="skeleton mb-6 h-40 rounded-lg" />
      <div className="skeleton mb-4 h-8 w-48 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
